import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsIn,
  IsDateString,
  MaxLength,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateAssigneeInlineDto } from './assignee-inline.dto';

export class CreateContractDto {
  // 메타
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pinId?: number;

  // 고객/거래처/영업담당자
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  customerPhone?: string; // 숫자만 받지 않을 수도 있어 포맷검증은 생략

  @IsOptional()
  @IsString()
  salespersonAccountId?: number;

  // 금액(프론트 계산값을 현재 구조 그대로 받음)
  @Type(() => Number)
  @IsNumber()
  brokerageFee!: number;

  @Type(() => Number)
  @IsNumber()
  vat!: number;

  @Type(() => Number)
  @IsNumber()
  brokerageTotal!: number;

  @Type(() => Number)
  @IsNumber()
  rebateTotal!: number;

  @Type(() => Number)
  @IsNumber()
  supportAmount!: number;

  @IsBoolean()
  isTaxed!: boolean;

  @IsOptional()
  @IsString()
  calcMemo?: string | null;

  @Type(() => Number)
  @IsNumber()
  grandTotal!: number;

  // 파일 URL
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUrl({ require_protocol: true }, { each: true })
  urls?: string[];

  // 최소 보강 필드(실적/리스트용)
  @IsOptional()
  @IsDateString()
  contractDate?: string; // 'YYYY-MM-DD'

  @IsOptional()
  @IsIn(['ongoing', 'done', 'canceled'])
  status?: 'ongoing' | 'done' | 'canceled';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateAssigneeInlineDto)
  assignees?: CreateAssigneeInlineDto[];
}
