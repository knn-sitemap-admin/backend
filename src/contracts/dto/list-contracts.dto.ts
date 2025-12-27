import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ListContractsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number; //페이징

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  size?: number; //페이징

  @IsOptional()
  @IsString()
  q?: string; //검색어

  @IsOptional()
  @IsString()
  dateFrom?: string; // YYYY-MM-DD //시작일

  @IsOptional()
  @IsString()
  dateTo?: string; //끝나는일

  @IsOptional()
  @IsIn(['ongoing', 'done', 'canceled', 'rejected'])
  status?: 'ongoing' | 'done' | 'canceled' | 'rejected'; //상태

  @IsOptional()
  @IsIn(['contract_date', 'created_at'])
  orderBy?: 'contract_date' | 'created_at';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  orderDir?: 'ASC' | 'DESC';

  //팀

  //계정
}
