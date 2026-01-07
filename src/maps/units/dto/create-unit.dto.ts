import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min, IsBoolean, IsString } from 'class-validator';

export class CreateUnitDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  baths?: number;

  @IsOptional()
  @IsBoolean()
  hasLoft?: boolean;

  @IsOptional()
  @IsBoolean()
  hasTerrace?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
