import {
  PaginationParams,
  PaginationUtils,
} from '@/common/services/pagination.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { SendNotificationDto } from './notification.dto';
import { Expo, ExpoPushToken } from 'expo-server-sdk';
import { DbService } from '@/database/database.service';

@Injectable()
export class NotificationService {
  private expo: Expo;

  constructor(
    private readonly paginationUtils: PaginationUtils,
    private readonly db: DbService,
  ) {
    this.expo = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN,
    });
  }
  async getNotifications(query: PaginationParams, userId: string) {
    const { limit, skip } = this.paginationUtils.getPagination(query);
    const { all, notifications } = await this.db.$transaction(async (tx) => {
      const all = await tx.notification.count({
        where: {
          userId,
        },
      });

      const notifications = await tx.notification.findMany({
        where: {
          userId,
        },
        take: limit,
        skip,
      });

      return { all, notifications };
    });

    return {
      data: notifications,
      meta: this.paginationUtils.getMeta({
        limit,
        page: query.page,
        totalItems: all,
      }),
    };
  }

  //   this for internal use: DO NOT pass to controller directly
  async sendNotification(data: SendNotificationDto) {
    const { userId } = data;
    const checkUser = await this.db.user.findUnique({
      where: { id: userId },
      select: { fcm_token: true },
    });
    if (!checkUser) return console.log('User not found');
    if (!checkUser.fcm_token) return console.log('FCM Token not found');
    if (!Expo.isExpoPushToken(checkUser.fcm_token))
      return console.log('Invalid FCM Token');
    const message = {
      to: checkUser.fcm_token as ExpoPushToken,
      sound: 'default',
      title: data.title,
      body: data.message,
      data: {},
      richContent: data.image
        ? {
            image: data.image,
          }
        : undefined,
    };

    const chunks = this.expo.chunkPushNotifications([message]);
    for (const chunk of chunks) {
      try {
        await this.expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.log('Failed to send Notification');
        continue;
      }
    }
  }
}
