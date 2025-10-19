import { IsIn, IsNumber, MaxLength } from 'class-validator';

// 기본값 있는 컬럼은 프론트가 안보내면 서비스에서 0/false로 보정
export class CreateContractAssigneeDto {
  accountId?: number;

  @MaxLength(100)
  assigneeName?: string;

  @IsIn(['company', 'staff'])
  role!: 'company' | 'staff';

  @IsNumber()
  sharePercent!: number; // 0~100 기대(검증은 프론트)

  @IsNumber()
  rebateAmount!: number;

  @IsNumber()
  finalAmount!: number;

  isManual?: boolean;

  // 선택(기본 0)
  sortOrder?: number;
}
