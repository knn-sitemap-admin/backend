import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { BuildingType } from '../entities/pin.entity';

export class SearchPinsDto {
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Transform(({ value }) => {
    if (value == null) return undefined;
    // rooms=1&rooms=2 -> ['1','2']
    if (Array.isArray(value)) {
      return value.map((v) => Number(v));
    }
    // rooms=1 -> '1'
    const n = Number(value);
    if (Number.isNaN(n)) return undefined;
    return [n];
  })
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

  @IsOptional()
  @IsArray()
  @Type(() => String)
  @IsIn(['APT', 'OP', '주택', '근생', '도생'], { each: true })
  buildingTypes?: BuildingType[];

  // 추가: 핀의 최저 실입주금 상한
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minRealMoveInCostMax?: number;
}
