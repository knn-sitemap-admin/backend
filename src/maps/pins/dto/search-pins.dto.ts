import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class SearchPinsDto {
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  rooms?: number[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasLoft?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasTerrace?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasElevator?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salePriceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salePriceMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  areaMinM2?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  areaMaxM2?: number;
}
