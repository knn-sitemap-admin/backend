import {
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum DraftStateFilter {
  BEFORE = 'before',
  SCHEDULED = 'scheduled',
  ALL = 'all',
}

export class MapPinsDto {
  /** 남서(SW) */
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  swLat!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  swLng!: number;

  /** 북동(NE) */
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  neLat!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  neLng!: number;

  /** 카카오맵 줌 레벨 클러스터링 */
  // @Type(() => Number)
  // @IsInt()
  // @Min(1)
  // @Max(20)
  // zoom!: number;

  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  isOld?: boolean;

  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  isNew?: boolean;

  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  favoriteOnly?: boolean;

  @IsOptional()
  @IsEnum(DraftStateFilter)
  draftState?: DraftStateFilter;
}
