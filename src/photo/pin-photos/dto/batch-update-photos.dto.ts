import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PhotoPatchDto {
  @IsNotEmpty()
  id!: number | string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  moveGroupId?: string;
  
  @IsOptional()
  groupId?: string;
}

export class BatchUpdatePhotosDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhotoPatchDto)
  patches!: PhotoPatchDto[];
}
