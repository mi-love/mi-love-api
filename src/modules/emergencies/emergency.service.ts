import { BadGatewayException, Injectable } from '@nestjs/common';
import {
  MetaWebhookParamsDto,
  MetaWebhookResponse,
  PanicDto,
} from './emergency.dto';
import { WhatsappService } from '@/common/services/whatsapp.service';
import { UserWithoutPassword } from '@/common/types/db';
import { LocationService } from '@/common/services/location.service';
import { DbService } from '@/database/database.service';

@Injectable()
export class EmergencyService {
  constructor(
    readonly whatsappService: WhatsappService,
    readonly locationService: LocationService,
    readonly db: DbService,
  ) {}

  async handlePanicButtonPress(user: UserWithoutPassword, json: PanicDto) {
    const body = json ?? {};
    const location = await this.locationService.getLocationWithCoords(
      body.latitude,
      body.longitude,
    );
    const contact = user.emergency_contact;
    const loc = location?.display_name ?? 'N/A';
    const message = `
🚨 PANIC ALERT 🚨
${user.first_name} ${user.last_name} initiated a panic alert on Milove dating app
Email: ${user.email}
Location: ${loc}
Latitude: ${body.latitude ?? 'Unknown'}
Longitude: ${body.longitude ?? 'Unknown'}
View Map: https://www.google.com/maps?q=${body.latitude},${body.longitude}
`;
    // const panic_action = await this.db.panic_actions.create({
    //   data: {
    //     user: {
    //       connect: {
    //         id: user.id,
    //       },
    //     },
    //     latitude: body.latitude,
    //     longitude: body.longitude,
    //   },
    // });
    if (contact) {
      const response = await this.whatsappService.sendMessage({
        to: contact,
        message,
        type: 'text',
      });

      const messageId = response?.data?.messages?.[0].id;
      if (messageId) {
        await this.whatsappService.sendMessage({
          to: contact,
          message,
          type: 'location',
          context: {
            message_id: messageId,
          },
          location: {
            latitude: body.latitude,
            longitude: body.longitude,
          },
        });
      }
      return {
        message: 'Panic Alert sent successfully',
      };
    }

    return {
      message: 'Panic Alert not sent due to no contact',
    };
  }

  async handleWebhook(body: MetaWebhookResponse, query: MetaWebhookParamsDto) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    const web = body.entry?.[0].changes?.[0]?.value;
    const isMessage = web?.messages?.length > 0;
    const type = web?.messages?.[0]?.type;
    if (isMessage && type === 'text') {
      const from = web?.messages?.[0]?.from;
      console.log('[META webhook]', web.messages?.[0].text?.body, from);
    }
    // const reply_id =
    //   body.entry?.[0].changes?.[0].value?.messages?.[0]?.interactive
    //     ?.button_reply?.id;

    // if (type == 'interactive' && reply_id) {
    //   const action = await this.db.panic_actions.findUnique({
    //     where: {
    //       id: reply_id,
    //     },
    //   });
    //   if (action) {
    //     const mapUrl = `https://www.google.com/maps?q=${action.latitude},${action.longitude}`;
    //     await this.whatsappService.sendMessage({
    //       to: body.entry[0].changes[0].value.messages[0].from ?? '',
    //       message: `${mapUrl}`,
    //     });
    //   }
    // }

    if (mode && token == process.env.META_TOKEN_VERIFICATION_KEY) {
      return challenge;
    }
    throw new BadGatewayException({ message: 'Invalid webhook verification' });
  }
}
