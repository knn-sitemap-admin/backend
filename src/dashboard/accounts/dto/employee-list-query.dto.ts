import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export type EmployeeListSort = 'name' | 'rank';

export class EmployeeListQueryDto {
  @IsOptional()
  @IsIn(['name', 'rank'])
  sort?: EmployeeListSort;

  // 검색은 이름만
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
