import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    folder: string = 'mi-love-api',
  ): Promise<{ secure_url: string; public_id: string }> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: fileName,
          // auto detects image vs video (required for mp4/mov/webm)
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else if (!result?.secure_url || !result?.public_id) {
            reject(new Error('Cloudinary upload returned empty result'));
          } else {
            resolve({
              secure_url: result.secure_url,
              public_id: result.public_id,
            });
          }
        },
      );

      uploadStream.end(fileBuffer);
    });
  }

  /** Stream large videos from disk (background worker) — avoids loading into RAM. */
  async uploadFromPath(
    filePath: string,
    fileName: string,
    folder: string = 'mi-love-api/videos',
  ): Promise<{ secure_url: string; public_id: string }> {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      public_id: fileName,
      resource_type: 'auto',
      chunk_size: 6_000_000,
    });

    if (!result?.secure_url || !result?.public_id) {
      throw new Error('Cloudinary upload returned empty result');
    }

    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
    };
  }

  async deleteFile(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  getFileType(mimeType: string): string {
    const mime = mimeType.split('/')[0];
    switch (mime) {
      case 'image':
        return 'image';
      case 'video':
        return 'video';
      default:
        return 'document';
    }
  }
}
