import {
  PaginationParams,
  PaginationUtils,
} from '@/common/services/pagination.service';
import { Injectable } from '@nestjs/common';
import { SendNotificationDto } from './notification.dto';
import { Expo } from 'expo-server-sdk';
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
        orderBy: { created_at: 'desc' },
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

  // Internal use only — not exposed on a public controller
  async sendNotification(data: SendNotificationDto) {
    const { userId } = data;
    const checkUser = await this.db.user.findUnique({
      where: { id: userId },
      select: { fcm_token: true },
    });
    if (!checkUser) {
      return;
    }

    await this.db.notification.create({
      data: {
        title: data.title,
        body: data.message,
        type: data.type,
        userId,
      },
    });

    const token = checkUser.fcm_token;
    if (!token || !Expo.isExpoPushToken(token)) {
      return;
    }

    const message = {
      to: token,
      sound: 'default',
      title: data.title,
      body: data.message,
      data: { type: data.type },
      richContent: data.image
        ? {
            image: data.image,
          }
        : undefined,
    };

    const chunks = this.expo.chunkPushNotifications([message]);
    for (const chunk of chunks) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        for (const ticket of tickets) {
          if (ticket.status === 'error') {
            const err = ticket.details?.error;
            if (err === 'DeviceNotRegistered') {
              await this.db.user.update({
                where: { id: userId },
                data: { fcm_token: null },
              });
            }
          }
        }
      } catch {
        // Network / Expo API failure — in-app notification row already saved
      }
    }
  }
}
