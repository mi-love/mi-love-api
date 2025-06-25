import { Injectable } from '@nestjs/common';
import { DbService } from '@/database/database.service';

@Injectable()
export class ProfileService {
  constructor(private db: DbService) {}

  async getProfile() {
    return {};
  }
}
