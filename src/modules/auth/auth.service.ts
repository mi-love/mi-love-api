import { Injectable } from '@nestjs/common';
import { DbService } from '@/database/database.service';

@Injectable()
export class AuthService {
  constructor(private readonly db: DbService) {}
  async signup() {
    return 'signup';
  }
}
