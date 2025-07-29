import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Request } from 'express';
import { DeleteProfileDto, EditProfileDto } from './profile.dto';
import { User } from '@/common/decorator/user.decorator';
import { UserWithoutPassword } from '@/common/types/db';

@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  @Get('me')
  async getProfile(@Req() req: Request) {
    return this.profileService.getProfile(req.user);
  }

  @Get(':id')
  async getProfileById(
    @Param('id') id: string,
    @User() user: UserWithoutPassword,
  ) {
    return this.profileService.getProfileById(id, user);
  }

  @Put('me')
  async editProfile(
    @Req() req: Request,
    @Body() editProfileDto: EditProfileDto,
  ) {
    return this.profileService.editProfile(req.user.id, editProfileDto);
  }

  @Post('delete')
  async deleteProfile(
    @Req() req: Request,
    @Body() deleteProfileDto: DeleteProfileDto,
  ) {
    return this.profileService.deleteProfile(req.user.id, deleteProfileDto);
  }
}
