import { notification_type } from "@prisma/client";

export class SendNotificationDto {
  userId: string;
  title: string;
  message: string;
  type: notification_type;
  image?: string;
}
