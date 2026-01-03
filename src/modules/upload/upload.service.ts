import { MulterFile } from '@/common/types/file';
import { DbService } from '@/database/database.service';
import { CloudinaryService } from '@/common/services/cloudinary.service';
import { Injectable, BadRequestException } from '@nestjs/common';
import { file_provider, file_type } from '@prisma/client';

@Injectable()
export class UploadService {
  constructor(
    private readonly db: DbService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  private getType(mimetype: string): file_type {
    const mime = mimetype.split('/')[0];
    switch (mime) {
      case 'image':
        return file_type.image;
      case 'video':
        return file_type.video;
      default:
        return file_type.document;
    }
  }

  async uploadToCloudinary(files: MulterFile[]) {
    try {
      const uploadPromises = files.map(async (file) => {
        if (!file.buffer) {
          throw new BadRequestException('File buffer not found');
        }

        // Upload to Cloudinary
        const result = await this.cloudinaryService.uploadFile(
          file.buffer,
          `${Date.now()}-${file.originalname}`,
          'mi-love-api',
        );

        // Save file metadata to database
        return await this.db.file.create({
          data: {
            type: this.getType(file.mimetype),
            provider: file_provider.cloudinary,
            url: result.secure_url,
            ref: result.public_id, // Store public_id for future deletion
          },
          select: {
            id: true,
            provider: true,
            url: true,
          },
        });
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      return {
        data: uploadedFiles,
      };
    } catch (error) {
      throw new BadRequestException(`File upload failed: ${error.message}`);
    }
  }

  async uploadLocal(files: MulterFile[]) {
    const allFiles = files.map(async (file) => {
      if (!file.path) return;
      return await this.db.file.create({
        data: {
          type: this.getType(file.mimetype),
          provider: file_provider.local,
          url: file.path,
        },
        select: {
          id: true,
          provider: true,
          // type: true,
          // url: true,
        },
      });
    });
    return {
      data: await Promise.all(allFiles),
    };
  }
}
