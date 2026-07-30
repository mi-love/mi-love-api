import { Processor, Process, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/common/services/logger.service';
import { VideoUploadProcessor } from '@/modules/upload/video-upload.processor';

export const VIDEO_UPLOAD_QUEUE = 'video-uploads';
export const VIDEO_UPLOAD_JOB = 'process-video';

export type VideoUploadJobPayload = {
  uploadJobId: string;
};

@Injectable()
@Processor(VIDEO_UPLOAD_QUEUE)
export class VideoUploadConsumer {
  constructor(
    private readonly processor: VideoUploadProcessor,
    private readonly logger: LoggerService,
  ) {}

  @Process({ name: VIDEO_UPLOAD_JOB, concurrency: 2 })
  async processVideo(job: Job<VideoUploadJobPayload>) {
    this.logger.log(
      `Processing video upload job ${job.data.uploadJobId} (bull=${job.id})`,
      'VideoUploadConsumer',
    );
    return this.processor.processUploadJob(job.data.uploadJobId);
  }

  @OnQueueCompleted()
  onCompleted(job: Job<VideoUploadJobPayload>) {
    this.logger.log(
      `Video upload completed job=${job.data.uploadJobId}`,
      'VideoUploadConsumer',
    );
  }

  @OnQueueFailed()
  onFailed(job: Job<VideoUploadJobPayload>, error: Error) {
    this.logger.error(
      `Video upload failed job=${job?.data?.uploadJobId}: ${error.message}`,
      error.stack,
      'VideoUploadConsumer',
    );
  }
}
