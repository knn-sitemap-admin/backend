import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdatePinPhotoDto {
  @IsArray()
  @IsInt({ each: true })
  photoIds!: number[];

  @IsOptional()
  @IsBoolean()
  isCover?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  moveGroupId?: string;
}
