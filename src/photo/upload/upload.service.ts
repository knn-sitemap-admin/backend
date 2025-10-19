import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Express } from 'express';
import * as AWS from 'aws-sdk';

@Injectable()
export class UploadService {
  private readonly s3: AWS.S3;
  private readonly bucketName: string;
  private readonly allowedDomains = [
    'map',
    'contracts',
    'board',
    'profile',
    'etc',
  ];

  constructor() {
    this.s3 = new AWS.S3({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    this.bucketName = process.env.AWS_S3_BUCKET_NAME || '';
  }

  private getTimestamp(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${y}${m}${d}-${hh}${mm}${ss}`;
  }

  async uploadFiles(
    files: Express.Multer.File[],
    domain: string,
    userId: number,
  ) {
    if (!files?.length) {
      throw new BadRequestException('업로드할 파일이 없습니다.');
    }

    if (!this.allowedDomains.includes(domain)) {
      throw new BadRequestException(
        `허용되지 않은 domain 입니다. (${this.allowedDomains.join(', ')})`,
      );
    }

    if (!userId) {
      throw new BadRequestException('로그인된 사용자만 업로드할 수 있습니다.');
    }

    const timestamp = this.getTimestamp();
    const urls: string[] = [];

    for (const file of files) {
      const key = `${domain}/${userId}/${timestamp}-${file.originalname}`;

      try {
        await this.s3
          .putObject({
            Bucket: this.bucketName,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
          })
          .promise();

        const url = `https://${this.bucketName}.s3.${this.s3.config.region}.amazonaws.com/${key}`;
        urls.push(url);
      } catch {
        throw new InternalServerErrorException(
          `파일 업로드 실패: ${file.originalname}`,
        );
      }
    }

    return { urls, domain, userId };
  }
}
