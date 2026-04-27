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
    const dbUser = await this.db.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        emergency_contact: true,
        home_address: true,
      },
    });

    const emergencyEmail = dbUser?.emergency_contact?.trim() || '';
    const emergencyNumber =
      body.phone_number?.trim() ||
      body.emergency_contact?.trim() ||
      '';
    this.logger.log(
      `Panic alert requested userId=${user.id} emergencyNumber=${this.maskPhoneNumber(emergencyNumber)} emergencyContact=${this.maskEmail(emergencyEmail)} hasReason=${Boolean(body.reason)} hasLatitude=${body.latitude != null} hasLongitude=${body.longitude != null}`,
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
    if (emergencyEmail) {
      try {
        const mapUrl =
          body.latitude != null && body.longitude != null
            ? `https://www.google.com/maps?q=${body.latitude},${body.longitude}`
            : 'Unknown';

        const panicTime = this.formatPanicTime(new Date());
        const fullName = `${dbUser?.first_name || ''} ${dbUser?.last_name || ''}`.trim() ||
          'Unknown User';
        const reason = body.reason?.trim() || 'Not provided';
        const homeAddress = dbUser?.home_address?.trim() || 'Unknown';
        const template = this.buildPanicAlertEmailTemplate({
          fullName,
          emergencyEmail,
          emergencyNumber,
          reason,
          homeAddress,
          latitude: body.latitude,
          longitude: body.longitude,
          mapUrl,
          panicTime,
        });

        await this.mailService.sendEmail({
          to: emergencyEmail,
          subject: 'URGENT: Panic Alert Triggered',
          body: template,
        });

        this.logger.log(
          `Panic email sent successfully to=${this.maskEmail(emergencyEmail)}`,
        );

        return {
          message: 'Panic Alert sent successfully',
        };
      } catch (error: any) {
        const message = error?.message || 'Failed to send panic alert email';
        this.logger.error(
          `Panic email send failed to=${this.maskEmail(emergencyEmail)} error=${message}`,
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
      `Panic alert skipped userId=${user.id} due to missing emergency contact`,
    );

    return {
      message: 'Panic Alert not sent due to missing emergency contact',
    };
  }

  private buildPanicAlertEmailTemplate(data: {
    fullName: string;
    emergencyEmail: string;
    emergencyNumber: string;
    reason: string;
    homeAddress: string;
    latitude?: number;
    longitude?: number;
    mapUrl: string;
    panicTime: string;
  }): string {
    const accentColor = '#d41372';

    return `
      <div style="margin:0;padding:0;background:#f7f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7fb;padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ececf3;">
                <tr>
                  <td style="background:${accentColor};padding:18px 24px;color:#ffffff;">
                    <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;opacity:0.95;">Emergency Notification</div>
                    <div style="font-size:24px;font-weight:700;line-height:1.2;margin-top:6px;">Panic Alert Triggered</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;">This is an automated emergency alert. A panic event was triggered and requires immediate attention.</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="padding:10px 12px;border:1px solid #ececf3;background:#fafbfe;font-weight:600;width:42%;">User</td>
                        <td style="padding:10px 12px;border:1px solid #ececf3;">${data.fullName}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 12px;border:1px solid #ececf3;background:#fafbfe;font-weight:600;">Emergency Contact</td>
                        <td style="padding:10px 12px;border:1px solid #ececf3;">${data.emergencyEmail}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 12px;border:1px solid #ececf3;background:#fafbfe;font-weight:600;">Emergency Number</td>
                        <td style="padding:10px 12px;border:1px solid #ececf3;">${data.emergencyNumber || 'Unknown'}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 12px;border:1px solid #ececf3;background:#fafbfe;font-weight:600;">Reason</td>
                        <td style="padding:10px 12px;border:1px solid #ececf3;">${data.reason}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 12px;border:1px solid #ececf3;background:#fafbfe;font-weight:600;">Home Address</td>
                        <td style="padding:10px 12px;border:1px solid #ececf3;">${data.homeAddress}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 12px;border:1px solid #ececf3;background:#fafbfe;font-weight:600;">Latitude</td>
                        <td style="padding:10px 12px;border:1px solid #ececf3;">${data.latitude ?? 'Unknown'}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 12px;border:1px solid #ececf3;background:#fafbfe;font-weight:600;">Longitude</td>
                        <td style="padding:10px 12px;border:1px solid #ececf3;">${data.longitude ?? 'Unknown'}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 12px;border:1px solid #ececf3;background:#fafbfe;font-weight:600;">Alert Time</td>
                        <td style="padding:10px 12px;border:1px solid #ececf3;">${data.panicTime}</td>
                      </tr>
                    </table>

                    <div style="margin-top:20px;">
                      <a href="${data.mapUrl}" style="display:inline-block;background:${accentColor};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 18px;border-radius:8px;">Open Live Location</a>
                    </div>

                    <p style="margin:20px 0 0 0;font-size:12px;line-height:1.6;color:#6b7280;">This alert was generated by the Mi Love safety system. If this is not expected, investigate the account activity immediately.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;
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
