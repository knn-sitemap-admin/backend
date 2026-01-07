import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export type FilterType = 'THIS_MONTH' | 'MONTH' | 'QUARTER' | 'YEAR';

export class PerformanceFilterDto {
  @IsOptional()
  @IsEnum(['THIS_MONTH', 'MONTH', 'QUARTER', 'YEAR'])
  filterType?: FilterType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  quarter?: number;
}
