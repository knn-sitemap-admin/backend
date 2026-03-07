import { IsInt, Min, Matches, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSurveyReservationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pinDraftId!: number;

  // YYYY-MM-DD 형식만 허용
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'reservedDate must be YYYY-MM-DD',
  })
  reservedDate!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  insertAt?: number;

  /** 관리자/매니저가 대리로 예약할 때 대상 계정 ID */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assigneeId?: number;
}
