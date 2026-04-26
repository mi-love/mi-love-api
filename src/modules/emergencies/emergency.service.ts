import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  MetaWebhookParamsDto,
  MetaWebhookResponse,
  PanicDto,
} from './emergency.dto';
import { WhatsappService } from '@/common/services/whatsapp.service';
import { MailService } from '@/common/services/mail.service';
import { UserWithoutPassword } from '@/common/types/db';
import { DbService } from '@/database/database.service';

@Injectable()
export class EmergencyService {
  private readonly logger = new Logger(EmergencyService.name);

  constructor(
    readonly whatsappService: WhatsappService,
    readonly db: DbService,
    readonly mailService: MailService,
  ) {}

  async handlePanicButtonPress(user: UserWithoutPassword, json: PanicDto) {
    const body = json ?? {};
    const emergencyNumber =
      body.phone_number?.trim() ||
      body.emergency_contact?.trim() ||
      user.emergency_contact ||
      '';
    const panicEmail = user.email?.trim() || '';
    this.logger.log(
      `Panic alert requested userId=${user.id} emergencyNumber=${this.maskPhoneNumber(emergencyNumber)} panicEmail=${this.maskEmail(panicEmail)} hasReason=${Boolean(body.reason)} hasLatitude=${body.latitude != null} hasLongitude=${body.longitude != null}`,
    );
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
    if (panicEmail) {
      try {
        const mapUrl =
          body.latitude != null && body.longitude != null
            ? `https://www.google.com/maps?q=${body.latitude},${body.longitude}`
            : 'Unknown';

        const panicTime = this.formatPanicTime(new Date());
        const fullName = `${user.first_name} ${user.last_name}`.trim() ||
          'Unknown User';

        await this.mailService.sendEmail({
          to: panicEmail,
          subject: 'Panic Alert Triggered',
          body: [
            `A panic alert has been triggered by ${fullName}.`,
            '',
            `Email: ${panicEmail}`,
            `Emergency Number: ${emergencyNumber || 'Unknown'}`,
            `Reason: ${body.reason?.trim() || 'Not provided'}`,
            `Home Address: ${user.home_address?.trim() || 'Unknown'}`,
            `Latitude: ${body.latitude ?? 'Unknown'}`,
            `Longitude: ${body.longitude ?? 'Unknown'}`,
            `Map: ${mapUrl}`,
            `Time: ${panicTime}`,
          ].join('\n'),
        });

        this.logger.log(
          `Panic email sent successfully to=${this.maskEmail(panicEmail)}`,
        );

        return {
          message: 'Panic Alert sent successfully',
        };
      } catch (error: any) {
        const message = error?.message || 'Failed to send panic alert email';
        this.logger.error(
          `Panic email send failed to=${this.maskEmail(panicEmail)} error=${message}`,
        );

        throw new HttpException(
          {
            message,
            provider: 'email',
          },
          HttpStatus.BAD_GATEWAY,
        );
      }
    }

    this.logger.warn(
      `Panic alert skipped userId=${user.id} due to missing registered email`,
    );

    return {
      message: 'Panic Alert not sent due to missing registered email',
    };
  }

  private formatPanicTime(date: Date): string {
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'long' });
    const year = date.getFullYear();

    const mod10 = day % 10;
    const mod100 = day % 100;
    const suffix =
      mod10 === 1 && mod100 !== 11
        ? 'st'
        : mod10 === 2 && mod100 !== 12
          ? 'nd'
          : mod10 === 3 && mod100 !== 13
            ? 'rd'
            : 'th';

    const time = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return `${day}${suffix} ${month} ${year}, ${time}`;
  }

  private maskPhoneNumber(phoneNumber?: string | null): string {
    const normalized = (phoneNumber || '').replace(/\D/g, '');
    if (!normalized) {
      return 'missing';
    }

    if (normalized.length <= 4) {
      return normalized;
    }

    return `${normalized.slice(0, 3)}***${normalized.slice(-3)}`;
  }

  private maskEmail(email?: string | null): string {
    const value = (email || '').trim();
    if (!value || !value.includes('@')) {
      return 'missing';
    }

    const [name, domain] = value.split('@');
    if (!name || !domain) {
      return 'missing';
    }

    if (name.length <= 2) {
      return `${name[0] || '*'}***@${domain}`;
    }

    return `${name.slice(0, 2)}***@${domain}`;
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
