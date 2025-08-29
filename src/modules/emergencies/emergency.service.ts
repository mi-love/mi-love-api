import { Injectable } from '@nestjs/common';
import { PanicDto } from './emergency.dto';

@Injectable()
export class EmergencyService {
  constructor() {}

  async handlePanicButtonPress(userId: string, body: PanicDto) {
    console.log(userId, body);
  }
}
