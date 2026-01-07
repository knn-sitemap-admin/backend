import { IsBoolean, IsISO8601, IsOptional, IsString } from 'class-validator';

export class AssignTeamMemberDto {
  @IsString()
  teamId!: string;

  @IsString()
  accountId!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsISO8601()
  joinedAt?: string;
}
