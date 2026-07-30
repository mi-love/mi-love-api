import { MulterFile } from '@/common/types/file';
import { DbService } from '@/database/database.service';
import { CloudinaryService } from '@/common/services/cloudinary.service';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { file_provider, file_type, upload_job_status } from '@prisma/client';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as fs from 'fs';
import * as path from 'path';
import {
  VIDEO_UPLOAD_JOB,
  VIDEO_UPLOAD_QUEUE,
  VideoUploadJobPayload,
} from '@/queue/consumers/video-upload.consumer';
import { VideoUploadProcessor } from './video-upload.processor';
import { LoggerService } from '@/common/services/logger.service';

@Injectable()
export class UploadService {
  constructor(
    private readonly db: DbService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly videoProcessor: VideoUploadProcessor,
    private readonly logger: LoggerService,
    @Optional()
    @InjectQueue(VIDEO_UPLOAD_QUEUE)
    private readonly videoQueue?: Queue<VideoUploadJobPayload>,
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

  private isVideo(mimetype: string) {
    return mimetype.startsWith('video/');
  }

  private thumbnailUrl(url: string, type: file_type): string | null {
    if (type !== file_type.video) return null;
    if (url.includes('/video/upload/')) {
      return url
        .replace('/video/upload/', '/video/upload/so_0/')
        .replace(/\.(mp4|mov|webm|m4v|avi)(\?.*)?$/i, '.jpg$2');
    }
    return null;
  }

  private mapFile(file: {
    id: string;
    provider: file_provider;
    url: string;
    type: file_type;
  }) {
    return {
      id: file.id,
      provider: file.provider,
      url: file.url,
      type: file.type,
      thumbnailUrl: this.thumbnailUrl(file.url, file.type),
    };
  }

  private resolveLocalPath(file: MulterFile): string | null {
    if (file.path && fs.existsSync(file.path)) return file.path;
    return null;
  }

  private stageVideoToDisk(file: MulterFile): string {
    const existing = this.resolveLocalPath(file);
    if (existing) return existing;

    if (!file.buffer) {
      throw new BadRequestException('Video file buffer not found');
    }

    const dir = VideoUploadProcessor.stagingDir();
    const safeName = (file.originalname || 'video').replace(/[^\w.\-]+/g, '_');
    const localPath = path.join(dir, `${Date.now()}-${safeName}`);
    fs.writeFileSync(localPath, file.buffer);
    return localPath;
  }

  private async enqueueOrRun(uploadJobId: string) {
    if (this.videoQueue) {
      try {
        const bullJob = await this.videoQueue.add(
          VIDEO_UPLOAD_JOB,
          { uploadJobId },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: 100,
            removeOnFail: 50,
          },
        );
        await this.db.upload_job.update({
          where: { id: uploadJobId },
          data: { bullJobId: String(bullJob.id) },
        });
        return;
      } catch (error) {
        this.logger.warn(
          `Bull queue unavailable, falling back to in-process video upload: ${
            error instanceof Error ? error.message : error
          }`,
          'UploadService',
        );
      }
    }

    // Fallback when Redis/Bull is down — still process in background
    setImmediate(() => {
      this.videoProcessor.processUploadJob(uploadJobId).catch((err) => {
        this.logger.error(
          `In-process video upload failed for ${uploadJobId}`,
          err?.stack,
          'UploadService',
        );
      });
    });
  }

  /**
   * Images upload synchronously.
   * Videos are staged to disk and processed by the background video-upload queue.
   */
  async handleUpload(files: MulterFile[], userId: string) {
    const images: MulterFile[] = [];
    const videos: MulterFile[] = [];

    for (const file of files) {
      if (this.isVideo(file.mimetype)) videos.push(file);
      else images.push(file);
    }

    const data: ReturnType<UploadService['mapFile']>[] = [];
    if (images.length) {
      const synced = await this.uploadImagesSync(images);
      data.push(...synced);
    }

    const jobs: Array<{
      id: string;
      status: upload_job_status;
      originalName: string | null;
      mimeType: string | null;
      sizeBytes: number | null;
      progress: number;
    }> = [];

    for (const video of videos) {
      const localPath = this.stageVideoToDisk(video);
      const job = await this.db.upload_job.create({
        data: {
          userId,
          status: upload_job_status.queued,
          originalName: video.originalname,
          mimeType: video.mimetype,
          sizeBytes: video.size || null,
          localPath,
          progress: 0,
        },
      });

      await this.enqueueOrRun(job.id);

      jobs.push({
        id: job.id,
        status: job.status,
        originalName: job.originalName,
        mimeType: job.mimeType,
        sizeBytes: job.sizeBytes,
        progress: job.progress,
      });
    }

    if (jobs.length && !data.length) {
      return {
        message: 'Video upload queued',
        mode: 'async' as const,
        data: [],
        jobs,
      };
    }

    if (jobs.length && data.length) {
      return {
        message: 'Images uploaded; videos queued for background processing',
        mode: 'mixed' as const,
        data,
        jobs,
      };
    }

    return {
      message: 'Upload successful',
      mode: 'sync' as const,
      data,
      jobs: [],
    };
  }

  private async uploadImagesSync(files: MulterFile[]) {
    try {
      const uploaded = await Promise.all(
        files.map(async (file) => {
          const type = this.getType(file.mimetype);
          let result: { secure_url: string; public_id: string };

          const diskPath = this.resolveLocalPath(file);
          if (diskPath) {
            result = await this.cloudinaryService.uploadFromPath(
              diskPath,
              `${Date.now()}-${(file.originalname || 'image').replace(/[^\w.\-]+/g, '_')}`,
              'mi-love-api',
            );
            try {
              fs.unlinkSync(diskPath);
            } catch {
              // ignore
            }
          } else if (file.buffer) {
            result = await this.cloudinaryService.uploadFile(
              file.buffer,
              `${Date.now()}-${(file.originalname || 'image').replace(/[^\w.\-]+/g, '_')}`,
              'mi-love-api',
            );
          } else {
            throw new BadRequestException('File buffer not found');
          }

          const saved = await this.db.file.create({
            data: {
              type,
              provider: file_provider.cloudinary,
              url: result.secure_url,
              ref: result.public_id,
            },
            select: {
              id: true,
              provider: true,
              url: true,
              type: true,
            },
          });

          return this.mapFile(saved);
        }),
      );

      return uploaded;
    } catch (error) {
      throw new BadRequestException(
        `File upload failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async getJob(jobId: string, userId: string) {
    const job = await this.db.upload_job.findUnique({
      where: { id: jobId },
      include: {
        file: {
          select: {
            id: true,
            provider: true,
            url: true,
            type: true,
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException({ message: 'Upload job not found' });
    }
    if (job.userId !== userId) {
      throw new ForbiddenException({ message: 'Not your upload job' });
    }

    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      originalName: job.originalName,
      mimeType: job.mimeType,
      sizeBytes: job.sizeBytes,
      error: job.error,
      created_at: job.created_at,
      updated_at: job.updated_at,
      completed_at: job.completed_at,
      file: job.file
        ? {
            ...job.file,
            thumbnailUrl: this.thumbnailUrl(job.file.url, job.file.type),
          }
        : null,
    };
  }

  async listJobs(userId: string, status?: upload_job_status) {
    const jobs = await this.db.upload_job.findMany({
      where: {
        userId,
        ...(status ? { status } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: 50,
      include: {
        file: {
          select: {
            id: true,
            provider: true,
            url: true,
            type: true,
          },
        },
      },
    });

    return {
      data: jobs.map((job) => ({
        id: job.id,
        status: job.status,
        progress: job.progress,
        originalName: job.originalName,
        mimeType: job.mimeType,
        sizeBytes: job.sizeBytes,
        error: job.error,
        created_at: job.created_at,
        completed_at: job.completed_at,
        file: job.file
          ? {
              ...job.file,
              thumbnailUrl: this.thumbnailUrl(job.file.url, job.file.type),
            }
          : null,
      })),
    };
  }

  /** Retry a failed video upload job. */
  async retryJob(jobId: string, userId: string) {
    const job = await this.db.upload_job.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException({ message: 'Upload job not found' });
    }
    if (job.userId !== userId) {
      throw new ForbiddenException({ message: 'Not your upload job' });
    }
    if (job.status !== upload_job_status.failed) {
      throw new BadRequestException({
        message: 'Only failed jobs can be retried',
      });
    }
    if (!job.localPath || !fs.existsSync(job.localPath)) {
      throw new BadRequestException({
        message: 'Staged video no longer available; please re-upload',
      });
    }

    await this.db.upload_job.update({
      where: { id: jobId },
      data: {
        status: upload_job_status.queued,
        progress: 0,
        error: null,
        completed_at: null,
      },
    });

    await this.enqueueOrRun(jobId);

    return {
      message: 'Video upload re-queued',
      jobId,
      status: upload_job_status.queued,
    };
  }

  // Kept for any legacy callers
  async uploadToCloudinary(files: MulterFile[]) {
    return { data: await this.uploadImagesSync(files) };
  }
}
