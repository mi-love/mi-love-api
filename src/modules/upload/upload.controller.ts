import {
  Controller,
  Post,
  UploadedFiles,
  // UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
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
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'files', maxCount: 5 },
      { name: 'file', maxCount: 1 },
    ]),
  )
  uploadImage(
    @UploadedFiles()
    uploaded: { files?: Array<MulterFile>; file?: Array<MulterFile> },
  ) {
    const files = [...(uploaded?.files || []), ...(uploaded?.file || [])];

    if (!files.length)
      return {
        message: 'No files to upload',
        data: [],
      };
    // Use Cloudinary for uploads
    return this.uploadService.uploadToCloudinary(files);
  }
}
