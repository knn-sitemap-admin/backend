import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
} from 'class-validator';

export class AssignTeamMemberDto {
  @IsString()
  teamId!: string;

  @IsString()
  accountId!: string;

  @IsIn(['manager', 'staff'])
  role!: 'manager' | 'staff';

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsISO8601()
  joinedAt?: string;
}
