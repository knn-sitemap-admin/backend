import {
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum DraftStateFilter {
  BEFORE = 'before',
  SCHEDULED = 'scheduled',
  ALL = 'all',
}

export class MapPinsDto {
  /** 남서(SW) */
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  swLat?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  swLng?: number;

  /** 북동(NE) */
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  neLat?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  neLng?: number;

  /** 카카오맵 줌 레벨 클러스터링 */
  // @Type(() => Number)
  // @IsInt()
  // @Min(1)
  // @Max(20)
  // zoom!: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true" || value === "1" || value === true) return true;
    if (value === "false" || value === "0" || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isOld?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true" || value === "1" || value === true) return true;
    if (value === "false" || value === "0" || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isNew?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true" || value === "1" || value === true) return true;
    if (value === "false" || value === "0" || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  favoriteOnly?: boolean;

  @IsOptional()
  @IsEnum(DraftStateFilter)
  draftState?: DraftStateFilter;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true" || value === "1" || value === true) return true;
    if (value === "false" || value === "0" || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isCompleted?: boolean;
}
