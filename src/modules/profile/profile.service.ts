import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '@/database/database.service';
import { UserWithoutPassword } from '@/common/types/db';
import { DeleteProfileDto, EditProfileDto } from './profile.dto';
import { InterestService } from '@/common/services/interest.service';
import { AuthService } from '../auth/auth.service';
import bcrypt from 'bcryptjs';

@Injectable()
export class ProfileService {
  constructor(
    private db: DbService,
    private interestService: InterestService,
    private authService: AuthService,
  ) {}

  async getProfile(user: UserWithoutPassword) {
    return {
      data: user,
    };
  }

  async editProfile(userId: string, editProfileDto: EditProfileDto) {
    const user = await this.db.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
      });
    }

    if (editProfileDto?.profile_picture) {
      const checkProfilePicture = await this.db.file.findUnique({
        where: {
          id: editProfileDto.profile_picture,
        },
      });

      if (!checkProfilePicture) {
        throw new BadRequestException({
          message: 'Profile picture not found or failed to upload',
        });
      }
    }

    const addedInterests = editProfileDto?.added_interests;
    const removedInterests = editProfileDto?.removed_interests;

    if (addedInterests) {
      await this.interestService.addAndUpdateInterests(addedInterests, {
        userId,
      });
    }

    await this.db.user.update({
      where: {
        id: userId,
      },
      data: {
        first_name: editProfileDto?.first_name,
        last_name: editProfileDto?.last_name,
        username: editProfileDto?.username,
        phone_number: editProfileDto?.phone_number,
        country: editProfileDto?.country,
        gender: editProfileDto?.gender,
        bio: editProfileDto?.bio,
        profile_picture: editProfileDto?.profile_picture
          ? {
              connect: {
                id: editProfileDto.profile_picture,
              },
            }
          : undefined,
        interests:
          removedInterests?.length > 0
            ? {
                disconnect: removedInterests?.map((interest) => {
                  return {
                    name: interest,
                  };
                }),
              }
            : undefined,
      },
    });

    return {
      message: 'Profile updated successfully',
    };
  }

  async deleteProfile(userId: string, deleteProfileDto: DeleteProfileDto) {
    const user = await this.db.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
      });
    }

    const verifyToken = await this.authService.verifyOneTimeToken(
      deleteProfileDto.token,
    );

    if (verifyToken.email !== user.email) {
      throw new BadRequestException({
        message: 'Invalid token',
      });
    }

    // if user is not google or apple user
    if (!user.password && user.auth_provider != 'local') {
      throw new BadRequestException({
        message: 'Invalid user',
      });
    }

    if (!user.password) {
      await this.db.user.delete({
        where: {
          id: userId,
        },
      });

      return {
        message: 'Profile deleted successfully',
      };
    }

    const isValidPassword = await bcrypt.compare(
      deleteProfileDto.password,
      user.password,
    );

    if (!isValidPassword) {
      throw new BadRequestException({
        message: 'Invalid password',
      });
    }

    await this.db.user.delete({
      where: {
        id: userId,
      },
    });

    return {
      message: 'Profile deleted successfully',
    };
  }
}
