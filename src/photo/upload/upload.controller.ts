import {
  BadRequestException,
  Controller,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import * as uploadService_1 from './upload.service';
import { IsIn, IsString } from 'class-validator';
import { Type } from 'class-transformer';

const memoryStorage = multer.memoryStorage();

// 업로드 가능한 파일 확장자
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
] as const;

function isAllowedFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return (ALLOWED_FILE_EXTENSIONS as readonly string[]).includes(ext);
}

const maxSizeMB = Number(process.env.UPLOAD_MAX_SIZE_MB || 10);
const maxSizeBytes = maxSizeMB * 1024 * 1024;

class UploadQueryDto {
  @IsString()
  @IsIn(['map', 'contracts', 'board', 'profile', 'etc'])
  @Type(() => String)
  domain!: uploadService_1.AllowedDomain;
}

@Controller('photo/upload')
export class UploadController {
  constructor(private readonly uploadService: uploadService_1.UploadService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage,
      limits: { fileSize: maxSizeBytes },
      fileFilter: (req, file, cb) => {
        if (!isAllowedFile(file.originalname)) {
          return cb(
            new BadRequestException(
              `허용되지 않은 파일 형식: ${file.originalname}`,
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
    @Query() query: UploadQueryDto,
    @Req()
    req: any,
  ) {
    const me: string = String(
      req.user?.id ?? req.session?.user?.credentialId ?? '',
    );
    if (!me)
      throw new BadRequestException('로그인된 사용자만 업로드할 수 있습니다.');
    if (!files?.length)
      throw new BadRequestException('업로드할 파일이 없습니다.');

    const data = await this.uploadService.uploadFiles(files, query.domain, me);

    return {
      message: `파일 업로드 완료 (최대 ${maxSizeMB}MB)`,
      data,
    };
  }
}
