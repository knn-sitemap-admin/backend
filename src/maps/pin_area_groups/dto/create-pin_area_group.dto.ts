import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePinAreaGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string | null;

  // 전용(㎡)
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  exclusiveMinM2?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  exclusiveMaxM2?: number | null;

  // 실평(㎡)
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualMinM2?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualMaxM2?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(32767)
  sortOrder?: number;
}
