import { BadRequestException, Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { MulterModule } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { CloudinaryService } from '@/common/services/cloudinary.service';
import { diskStorage } from 'multer';
import { JwtService } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bull';
import * as fs from 'fs';
import * as path from 'path';
import {
  VIDEO_UPLOAD_QUEUE,
  VideoUploadConsumer,
} from '@/queue/consumers/video-upload.consumer';
import { VideoUploadProcessor } from './video-upload.processor';
import { LoggerService } from '@/common/services/logger.service';

const ALLOWED_IMAGE = /^image\/(jpeg|jpg|png|gif|webp|heic|heif)$/i;
const ALLOWED_VIDEO = /^video\/(mp4|quicktime|webm|x-m4v|x-msvideo)$/i;

/** Max upload size (videos need headroom; keep in sync with Cloudinary plan). */
const MAX_FILE_BYTES = 80 * 1024 * 1024; // 80 MB

const stagingRoot = path.join(process.cwd(), 'uploads', 'tmp');

@Module({
  imports: [
    BullModule.registerQueue({ name: VIDEO_UPLOAD_QUEUE }),
    MulterModule.register({
      storage: diskStorage({
        destination: (_req, file, callback) => {
          const sub = file.mimetype.startsWith('video/')
            ? path.join(stagingRoot, 'videos')
            : path.join(stagingRoot, 'images');
          fs.mkdirSync(sub, { recursive: true });
          callback(null, sub);
        },
        filename: (_req, file, callback) => {
          const safe = (file.originalname || 'file').replace(/[^\w.\-]+/g, '_');
          callback(null, `${Date.now()}-${safe}`);
        },
      }),
      limits: {
        fileSize: MAX_FILE_BYTES,
        files: 5,
      },
      fileFilter(_req, file, callback) {
        const ok =
          ALLOWED_IMAGE.test(file.mimetype) ||
          ALLOWED_VIDEO.test(file.mimetype);
        if (ok) {
          callback(null, true);
          return;
        }
        callback(
          new BadRequestException({
            message:
              'Invalid file type. Allowed: images (jpeg, png, gif, webp, heic) and videos (mp4, mov, webm)',
          }),
          false,
        );
      },
    }),
  ],
  providers: [
    UploadService,
    CloudinaryService,
    VideoUploadProcessor,
    VideoUploadConsumer,
    JwtService,
    LoggerService,
  ],
  controllers: [UploadController],
  exports: [UploadService, VideoUploadProcessor, CloudinaryService],
})
export class UploadModule {}
