import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateTeamAssignDto {
  @IsString()
  teamId!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean; // default: true

  @IsOptional()
  @IsDateString()
  joinedAt?: string; // 'YYYY-MM-DD'
}
