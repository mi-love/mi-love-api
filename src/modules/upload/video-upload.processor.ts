import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DbService } from '@/database/database.service';
import { CloudinaryService } from '@/common/services/cloudinary.service';
import { file_provider, file_type, upload_job_status } from '@prisma/client';
import { LoggerService } from '@/common/services/logger.service';

@Injectable()
export class VideoUploadProcessor {
  constructor(
    private readonly db: DbService,
    private readonly cloudinary: CloudinaryService,
    private readonly logger: LoggerService,
  ) {}

  private thumbnailUrl(url: string, type: file_type): string | null {
    if (type !== file_type.video) return null;
    if (url.includes('/video/upload/')) {
      return url
        .replace('/video/upload/', '/video/upload/so_0/')
        .replace(/\.(mp4|mov|webm|m4v|avi)(\?.*)?$/i, '.jpg$2');
    }
    return null;
  }

  private safeUnlink(filePath?: string | null) {
    if (!filePath) return;
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // ignore cleanup errors
    }
  }

  async processUploadJob(uploadJobId: string) {
    const job = await this.db.upload_job.findUnique({
      where: { id: uploadJobId },
    });

    if (!job) {
      throw new Error(`Upload job ${uploadJobId} not found`);
    }

    if (job.status === upload_job_status.completed && job.fileId) {
      return { alreadyCompleted: true, fileId: job.fileId };
    }

    if (!job.localPath || !fs.existsSync(job.localPath)) {
      await this.db.upload_job.update({
        where: { id: uploadJobId },
        data: {
          status: upload_job_status.failed,
          error: 'Staged video file missing on disk',
          progress: 0,
          completed_at: new Date(),
        },
      });
      throw new Error('Staged video file missing on disk');
    }

    await this.db.upload_job.update({
      where: { id: uploadJobId },
      data: {
        status: upload_job_status.processing,
        progress: 10,
        error: null,
      },
    });

    try {
      const publicId = `${Date.now()}-${(job.originalName || 'video').replace(/[^\w.\-]+/g, '_')}`;

      await this.db.upload_job.update({
        where: { id: uploadJobId },
        data: { progress: 30 },
      });

      const result = await this.cloudinary.uploadFromPath(
        job.localPath,
        publicId,
        'mi-love-api/videos',
      );

      await this.db.upload_job.update({
        where: { id: uploadJobId },
        data: { progress: 80 },
      });

      const saved = await this.db.file.create({
        data: {
          type: file_type.video,
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

      await this.db.upload_job.update({
        where: { id: uploadJobId },
        data: {
          status: upload_job_status.completed,
          progress: 100,
          fileId: saved.id,
          completed_at: new Date(),
          localPath: null,
          error: null,
        },
      });

      this.safeUnlink(job.localPath);

      this.logger.log(
        `Video uploaded to Cloudinary fileId=${saved.id} job=${uploadJobId}`,
        'VideoUploadProcessor',
      );

      return {
        file: {
          ...saved,
          thumbnailUrl: this.thumbnailUrl(saved.url, saved.type),
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Video upload failed';

      await this.db.upload_job.update({
        where: { id: uploadJobId },
        data: {
          status: upload_job_status.failed,
          error: message,
          progress: 0,
          completed_at: new Date(),
        },
      });

      // Keep local file for a possible retry; cleanup happens on success or TTL sweep
      throw error;
    }
  }

  /** Absolute path for staging directory */
  static stagingDir() {
    const dir = path.join(process.cwd(), 'uploads', 'tmp', 'videos');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }
}
