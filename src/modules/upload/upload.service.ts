import { MulterFile } from '@/common/types/file';
import { DbService } from '@/database/database.service';
import { Injectable } from '@nestjs/common';
import { file_provider, file_type } from '@prisma/client';
@Injectable()
export class UploadService {
  constructor(private readonly db: DbService) {}

  private getType(mimetype: string) {
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
