import { BadRequestException, Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { MulterModule } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { CloudinaryService } from '@/common/services/cloudinary.service';
import { memoryStorage } from 'multer';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      fileFilter(req, file, callback) {
        if (file.mimetype.startsWith('image/')) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException({
              message: 'Invalid file type',
            }),
            false,
          );
        }
      },
    }),
  ],
  providers: [UploadService, CloudinaryService],
  controllers: [UploadController],
})
export class UploadModule {}
