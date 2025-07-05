import { BadRequestException, Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { MulterModule } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { diskStorage } from 'multer';
import path from 'path';

@Module({
  imports: [
    MulterModule.register({
      dest: './uploads',
      preservePath: true,
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          callback(
            null,
            `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`,
          );
        },
      }),
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
  providers: [UploadService],
  controllers: [UploadController],
})
export class UploadModule {}
