import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ListContractsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  size?: number;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsIn(['ongoing', 'done', 'canceled', 'rejected'])
  status?: 'ongoing' | 'done' | 'canceled' | 'rejected';

  @IsOptional()
  @IsIn(['contract_date', 'created_at'])
  orderBy?: 'contract_date' | 'created_at';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  orderDir?: 'ASC' | 'DESC';
}
