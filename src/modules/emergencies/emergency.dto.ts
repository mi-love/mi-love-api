export class PanicDto {
  latitude: number;
  longitude: number;
  reason?: string;
}

export class MetaWebhookParamsDto {
  'hub.mode': 'subscribe';
  'hub.challenge': string;
  'hub.verify_token': string;
}

export class MetaWebhookResponse {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts: Array<{
          profile: {
            name: string;
          };
          wa_id: string;
        }>;
        messages: Array<{
          context?: {
            from: string;
            id: string;
          };
          from: string;
          id: string;
          timestamp: string;
          type: string;
          interactive?: {
            type: string;
            button_reply?: {
              id: string;
              title: string;
            };
          };
          text?: {
            body: string;
          };
        }>;
      };
      field: string;
    }>;
  }>;
}
