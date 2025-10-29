import { IsOptional } from 'class-validator';

export class ListContractsDto {
  @IsOptional()
  page?: number;
  @IsOptional()
  size?: number;
  @IsOptional()
  q?: string;

  @IsOptional()
  pinId?: number;
  @IsOptional()
  assigneeId?: number;
  @IsOptional()
  hasFiles?: boolean;

  @IsOptional()
  status?: 'ongoing' | 'done' | 'canceled';
  @IsOptional()
  dateFrom?: string; // 'YYYY-MM-DD'
  @IsOptional()
  dateTo?: string; // 'YYYY-MM-DD'
  @IsOptional()
  orderBy?: 'contract_date' | 'created_at'; // 기본: contract_date
  @IsOptional()
  orderDir?: 'ASC' | 'DESC'; // 기본: DESC
}
