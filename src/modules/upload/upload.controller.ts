import {
  Controller,
  Post,
  UploadedFiles,
  // UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
// import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

@Controller('upload')
// @UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files', 5))
  uploadImage(@UploadedFiles() files: Array<MulterFile>) {
    if (!files)
      return {
        message: 'No files to upload',
        data: [],
      };
    return this.uploadService.uploadLocal(files);
  }
}
