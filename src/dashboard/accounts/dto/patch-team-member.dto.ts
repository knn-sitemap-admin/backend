import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { TeamRole } from '../types/roles';

export class PatchTeamMemberDto {
  @IsOptional()
  @IsIn([TeamRole.MANAGER, TeamRole.STAFF])
  teamRole?: TeamRole;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
