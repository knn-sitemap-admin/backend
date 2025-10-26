import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateContractAssigneeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  accountId?: number;

  @IsOptional()
  @MaxLength(100)
  assigneeName?: string;

  @IsIn(['company', 'staff'])
  role!: 'company' | 'staff';

  @Type(() => Number)
  @IsNumber()
  sharePercent!: number; // 0~100 기대(검증은 프론트)

  @Type(() => Number)
  @IsNumber()
  rebateAmount!: number;

  @Type(() => Number)
  @IsNumber()
  finalAmount!: number;

  @IsOptional()
  @IsBoolean()
  isManual?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}
