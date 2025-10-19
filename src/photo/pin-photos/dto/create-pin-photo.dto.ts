import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  ArrayNotEmpty,
} from 'class-validator';

export class CreatePinPhotoDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  urls!: string[];

  @IsOptional()
  @IsBoolean()
  isCover?: boolean;

  @IsOptional()
  @IsInt({ each: true })
  sortOrders?: number[];
}
