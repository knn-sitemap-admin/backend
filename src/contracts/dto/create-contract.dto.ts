import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  ArrayMaxSize,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateContractAssigneeInputDto {
  @IsString()
  accountId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  sharePercent!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  // finalAmount는 정책상 저장/입력 금지
}

export class CreateContractDto {
  @IsString()
  @MaxLength(100)
  customerName!: string;

  @IsString()
  @MaxLength(30)
  customerPhone!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  brokerageFee!: number;

  @IsBoolean()
  vat!: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  rebate!: number; // units

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  supportAmount!: number;

  @IsBoolean()
  isTaxed!: boolean;

  @IsOptional()
  @IsString()
  calcMemo?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  companyPercent!: number;

  @IsDateString()
  contractDate!: string; // YYYY-MM-DD

  @IsDateString()
  finalPaymentDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: 'ongoing' | 'done' | 'canceled' | 'rejected';

  @IsString()
  @MaxLength(255)
  siteAddress!: string;

  @IsString()
  @MaxLength(100)
  siteName!: string;

  @IsString()
  @MaxLength(30)
  salesTeamPhone!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUrl({ require_protocol: true }, { each: true })
  urls?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateContractAssigneeInputDto)
  assignees?: CreateContractAssigneeInputDto[];
}
