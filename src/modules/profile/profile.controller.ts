import { Controller, Get, Put } from '@nestjs/common';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  @Get('me')
  async getProfile() {
    return this.profileService.getProfile();
  }

  @Put('me')
  async editProfile() {
    return 'edit';
  }
}
