import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Request } from 'express';
import { upload_job_status } from '@prisma/client';
import { MulterFile } from '@/common/types/file';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * Upload images (sync) and/or videos (background queue).
   * Form fields: `files` (up to 5) or single `file`.
   * Videos return `jobs[]` — poll `GET /upload/jobs/:jobId`.
   */
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'files', maxCount: 5 },
      { name: 'file', maxCount: 1 },
    ]),
  )
  uploadMedia(
    @UploadedFiles()
    uploaded: { files?: Array<MulterFile>; file?: Array<MulterFile> },
    @Req() req: Request,
  ) {
    const files = [...(uploaded?.files || []), ...(uploaded?.file || [])];

    if (!files.length) {
      return {
        message: 'No files to upload',
        mode: 'sync',
        data: [],
        jobs: [],
      };
    }

    return this.uploadService.handleUpload(files, req.user.id);
  }

  /** Poll background video upload status — declare before `jobs/:jobId`. */
  @Get('/jobs')
  listJobs(
    @Req() req: Request,
    @Query('status') status?: upload_job_status,
  ) {
    return this.uploadService.listJobs(req.user.id, status);
  }

  /** Poll a single background video upload job. */
  @Get('/jobs/:jobId')
  getJob(@Param('jobId') jobId: string, @Req() req: Request) {
    return this.uploadService.getJob(jobId, req.user.id);
  }

  /** Re-queue a failed video upload (if staged file still exists). */
  @Post('/jobs/:jobId/retry')
  retryJob(@Param('jobId') jobId: string, @Req() req: Request) {
    return this.uploadService.retryJob(jobId, req.user.id);
  }
}
