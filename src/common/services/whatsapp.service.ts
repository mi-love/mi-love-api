import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

interface SendMessageParams {
  to: string;
  message: string;
  type: 'text' | 'interactive' | 'location';
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  actions?: {
    buttons: {
      type: string;
      reply: {
        id: string;
        title: string;
      };
    }[];
  };
  context?: {
    message_id: string;
  };
}

/**
 * Parameters for Meta Cloud API template message.
 * `bodyParameters` are the positional values that map to {{1}}, {{2}}, ... in the
 * approved template body, in order.
 */
interface SendTemplateMessageParams {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParameters: string[];
}

interface SendPanicAlertTemplateParams {
  to: string;
  name: string;         // {{1}}
  email: string;        // {{2}}
  location: string;     // {{3}}
  latitude: string;     // {{4}}
  longitude: string;    // {{5}}
  time: string;         // {{6}}
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly apiBase = 'https://graph.facebook.com/v25.0';
  private phoneNumberId: string;
  private businessId: string;
  private fromNumber: string;
  private accessToken: string;

  constructor() {
    this.phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
    this.businessId = (process.env.WHATSAPP_BUSINESS_ID || '').trim();
    this.fromNumber = this.normalizePhoneNumber(process.env.WHATSAPP_FROM_NUMBER || '');
    this.accessToken = (
      process.env.META_ACCESS_TOKEN ||
      process.env.BEARER_TOKEN ||
      ''
    ).trim();
  }

  async sendMessage({ to, message, type, location, actions }: SendMessageParams) {
    try {
      if (!this.accessToken) {
        this.logger.error('META_ACCESS_TOKEN/BEARER_TOKEN is missing');
        return { status: 400, error: 'META_ACCESS_TOKEN/BEARER_TOKEN is missing' };
      }

      if (!this.phoneNumberId) {
        await this.resolvePhoneNumberId();
      }

      if (!this.phoneNumberId) {
        this.logger.error(
          'WHATSAPP_PHONE_NUMBER_ID is missing and auto-resolution failed (set WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_BUSINESS_ID + WHATSAPP_FROM_NUMBER)',
        );
        return {
          status: 400,
          error:
            'WHATSAPP_PHONE_NUMBER_ID is missing and auto-resolution failed (set WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_BUSINESS_ID + WHATSAPP_FROM_NUMBER)',
        };
      }

      const recipient = this.normalizePhoneNumber(to);
      if (!recipient) {
        this.logger.warn(`Invalid phone number: ${this.maskPhoneNumber(to)}`);
        return { status: 400, error: 'Invalid WhatsApp destination number' };
      }

      this.logger.log(
        `Preparing Meta message type=${type} to=${this.maskPhoneNumber(recipient)}`,
      );

      let body: string;
      if (type === 'location' && location) {
        body = this.buildLocationText(message, location);
      } else if (type === 'interactive' && actions?.buttons?.length) {
        const buttons = actions.buttons
          .map((btn, i) => `${i + 1}. ${btn.reply.title}`)
          .join('\n');
        body = `${message}\n\n${buttons}`;
      } else {
        body = message;
      }

      return this.sendTextMessage(recipient, body);
    } catch (error: any) {
      this.logger.error(
        `Meta sendMessage failed: ${error?.message || 'Unknown error'}`,
        error?.stack,
      );
      return {
        status: error?.response?.status || 400,
        error: this.getMetaErrorMessage(error, 'Failed to send WhatsApp message'),
        data: error?.response?.data,
      };
    }
  }

  async sendTemplateMessage({
    to,
    templateName,
    languageCode = 'en_US',
    bodyParameters,
  }: SendTemplateMessageParams) {
    try {
      if (!this.accessToken) {
        this.logger.error('META_ACCESS_TOKEN/BEARER_TOKEN is missing');
        return { status: 400, error: 'META_ACCESS_TOKEN/BEARER_TOKEN is missing' };
      }

      if (!this.phoneNumberId) {
        await this.resolvePhoneNumberId();
      }

      if (!this.phoneNumberId) {
        this.logger.error(
          'WHATSAPP_PHONE_NUMBER_ID is missing and auto-resolution failed (set WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_BUSINESS_ID + WHATSAPP_FROM_NUMBER)',
        );
        return {
          status: 400,
          error:
            'WHATSAPP_PHONE_NUMBER_ID is missing and auto-resolution failed (set WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_BUSINESS_ID + WHATSAPP_FROM_NUMBER)',
        };
      }

      const recipient = this.normalizePhoneNumber(to);
      if (!recipient) {
        this.logger.warn(`Invalid phone number: ${this.maskPhoneNumber(to)}`);
        return { status: 400, error: 'Invalid WhatsApp destination number' };
      }

      const endpoint = `${this.apiBase}/${this.phoneNumberId}/messages`;
      const components = bodyParameters.length
        ? [
            {
              type: 'body',
              parameters: bodyParameters.map((text) => ({
                type: 'text',
                text,
              })),
            },
          ]
        : undefined;
      const payload = {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          ...(components ? { components } : {}),
        },
      };

      this.logger.log(
        `Sending Meta template template=${templateName} lang=${languageCode} to=${this.maskPhoneNumber(recipient)} params=${bodyParameters.length}`,
      );
      this.logger.debug(
        `Meta template payload=${JSON.stringify({
          ...payload,
          template: {
            ...payload.template,
            ...(components
              ? {
                  components: [
                    {
                      type: 'body',
                      parameters: bodyParameters.map((text, i) => ({
                        type: 'text',
                        text: this.maskParamByIndex(i, text),
                      })),
                    },
                  ],
                }
              : {}),
          },
        })}`,
      );

      const response = await axios.post(endpoint, payload, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const raw = response.data ?? {};
      this.logger.log(
        `Meta template response status=${response.status} messages=${JSON.stringify(raw?.messages ?? [])}`,
      );
      this.logger.debug(`Meta template response body=${JSON.stringify(raw)}`);

      const messageId = raw?.messages?.[0]?.id ?? null;
      return {
        status: response.status,
        data: {
          ...raw,
          messages: messageId ? [{ id: String(messageId) }] : [],
        },
      };
    } catch (error: any) {
      this.logger.error(
        `Meta template request failed: ${error?.message || 'Unknown error'}`,
        error?.stack,
      );
      if (error?.response) {
        this.logger.error(
          `Meta template error response status=${error.response.status} body=${JSON.stringify(error.response.data)}`,
        );
      }
      return {
        status: error?.response?.status || 400,
        error: this.getMetaErrorMessage(error, 'Failed to send WhatsApp template message'),
        data: error?.response?.data,
      };
    }
  }

  async sendPanicAlertTemplate({
    to,
    name,
    email,
    location,
    latitude,
    longitude,
    time,
  }: SendPanicAlertTemplateParams) {
    const token = (process.env.WHATSAPP_TOKEN || '').trim();
    const phoneNumberId = (process.env.PHONE_NUMBER_ID || '').trim();

    if (!token) {
      throw new Error('WHATSAPP_TOKEN is missing');
    }

    if (!phoneNumberId) {
      throw new Error('PHONE_NUMBER_ID is missing');
    }

    const recipient = this.normalizePhoneNumber(to);
    if (!recipient) {
      throw new Error('Invalid WhatsApp destination number');
    }

    const endpoint = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'template',
      template: {
        name: 'mi_love_api',
        language: {
          code: 'en',
        },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: String(name) },       // {{1}} name
              { type: 'text', text: String(email) },      // {{2}} email
              { type: 'text', text: String(location) },   // {{3}} location
              { type: 'text', text: String(latitude) },   // {{4}} latitude
              { type: 'text', text: String(longitude) },  // {{5}} longitude
              { type: 'text', text: String(time) },       // {{6}} time
            ],
          },
        ],
      },
    };

    try {
      const response = await axios.post(endpoint, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const messageId = response.data?.messages?.[0]?.id;
      if (messageId) {
        this.logger.log(`Meta panic template message id=${messageId}`);
      }

      return response.data;
    } catch (error: any) {
      const metaError =
        error?.response?.data?.error?.message || error?.message || 'Failed to send panic alert template message';
      this.logger.error(`sendPanicAlertTemplate failed: ${metaError}`);
      throw new Error(metaError);
    }
  }

  private async sendTextMessage(recipient: string, body: string) {
    if (!this.accessToken) {
      throw new Error('META_ACCESS_TOKEN/BEARER_TOKEN is missing');
    }

    if (!this.phoneNumberId) {
      await this.resolvePhoneNumberId();
    }

    if (!this.phoneNumberId) {
      throw new Error(
        'WHATSAPP_PHONE_NUMBER_ID is missing and auto-resolution failed (set WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_BUSINESS_ID + WHATSAPP_FROM_NUMBER)',
      );
    }

    const endpoint = `${this.apiBase}/${this.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'text',
      text: { body },
    };

    this.logger.log(
      `Sending Meta text message to=${this.maskPhoneNumber(recipient)}`,
    );

    const response = await axios.post(endpoint, payload, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const raw = response.data ?? {};
    this.logger.log(`Meta text response status=${response.status}`);
    this.logger.debug(`Meta text response body=${JSON.stringify(raw)}`);

    const messageId = raw?.messages?.[0]?.id ?? null;
    return {
      status: response.status,
      data: {
        ...raw,
        messages: messageId ? [{ id: String(messageId) }] : [],
      },
    };
  }

  private normalizePhoneNumber(to: string): string {
    const raw = (to ?? '')
      .toString()
      .trim()
      .replace(/\s+/g, '')
      .replace(/^"+|"+$/g, '');
    if (!raw) return '';
    // Strip whatsapp: prefix and leading +, keep digits only
    const normalized = raw.replace(/^whatsapp:/i, '').replace(/^\+/, '');
    return /^\d{8,15}$/.test(normalized) ? normalized : '';
  }

  private buildLocationText(
    message: string,
    location: { latitude: number; longitude: number; name?: string },
  ): string {
    const mapUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
    const name = location.name?.trim();
    const locationLabel = name
      ? `Location: ${name} (${location.latitude}, ${location.longitude})`
      : `Location: ${location.latitude}, ${location.longitude}`;
    return `${message}\n${locationLabel}\nView Map: ${mapUrl}`;
  }

  private maskPhoneNumber(phoneNumber: string): string {
    const normalized = (phoneNumber || '').replace(/\D/g, '');
    if (normalized.length <= 4) return normalized || 'unknown';
    return `${normalized.slice(0, 3)}***${normalized.slice(-3)}`;
  }

  private async resolvePhoneNumberId(): Promise<void> {
    if (this.phoneNumberId) {
      return;
    }

    if (!this.businessId) {
      return;
    }

    if (!this.accessToken) {
      return;
    }

    try {
      const endpoint = `${this.apiBase}/${this.businessId}/phone_numbers`;
      const response = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      const phoneNumbers: Array<{ id?: string; display_phone_number?: string }> =
        response.data?.data ?? [];

      if (!phoneNumbers.length) {
        this.logger.warn(
          `No phone numbers returned for WHATSAPP_BUSINESS_ID=${this.businessId}`,
        );
        return;
      }

      let selected = phoneNumbers[0];
      if (this.fromNumber) {
        const match = phoneNumbers.find(
          (item) =>
            this.normalizePhoneNumber(item.display_phone_number || '') ===
            this.fromNumber,
        );
        if (match) {
          selected = match;
        }
      }

      this.phoneNumberId = (selected?.id || '').trim();
      if (this.phoneNumberId) {
        this.logger.log(
          `Resolved WHATSAPP_PHONE_NUMBER_ID=${this.phoneNumberId} from WHATSAPP_BUSINESS_ID`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to resolve phone number id from business id: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  private getMetaErrorMessage(error: any, fallback: string): string {
    const code = error?.response?.data?.error?.code;
    const subcode = error?.response?.data?.error?.error_subcode;

    if (code === 190) {
      return 'Meta access token is invalid or expired';
    }

    if (code === 100 && subcode === 33) {
      return 'Configured WhatsApp phone number ID or business access is invalid for this Meta token';
    }

    return (
      error?.response?.data?.error?.message ||
      error?.response?.data?.error?.error_data?.details ||
      error?.message ||
      fallback
    );
  }

  /** Masks the first two positional params (name, email) in debug logs. */
  private maskParamByIndex(index: number, value: string): string {
    if (index === 0) {
      // name — show initials only
      return String(value)
        .split(' ')
        .filter(Boolean)
        .map((part) => `${part[0]}***`)
        .join(' ');
    }
    if (index === 1) {
      // email
      const [local = '', domain = ''] = String(value).split('@');
      return `${local.slice(0, 2)}***${domain ? '@' + domain : ''}`;
    }
    return String(value).length > 24 ? `${String(value).slice(0, 24)}...` : String(value);
  }
}
