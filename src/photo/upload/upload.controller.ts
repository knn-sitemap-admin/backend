import {
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { UploadService } from './upload.service';

// 업로드 가능한 파일 확장명 리스트
const ALLOWED_FILE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
  'hwp',
  'hwpx',
];

// 확장자 기준 필터링
function isAllowedFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ALLOWED_FILE_EXTENSIONS.includes(ext);
}

const memoryStorage = multer.memoryStorage();

const maxSizeMB = Number(process.env.UPLOAD_MAX_SIZE_MB || 10); // 기본값 10MB
const maxSizeBytes = maxSizeMB * 1024 * 1024;

@Controller('photo/upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage,
      limits: { fileSize: maxSizeBytes },
      fileFilter: (req, file, cb) => {
        if (!isAllowedFile(file.originalname)) {
          return cb(
            new BadRequestException(
              `허용되지 않은 파일 형식입니다. (${file.originalname})`,
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('domain') domain: string,
    @Req() req: any,
  ) {
    if (!domain) throw new BadRequestException('domain 쿼리값이 필요합니다.');

    const userId = req.user?.id || req.session?.user?.id;
    const data = await this.uploadService.uploadFiles(files, domain, userId);

    return {
      message: `파일 업로드 완료 (최대 ${maxSizeMB}MB, 허용 확장자 ${process.env.ALLOWED_EXTENSIONS || ''})`,
      data,
    };
  }
}
