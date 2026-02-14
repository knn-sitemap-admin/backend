import { IsEnum, IsString, ValidateIf } from 'class-validator';
import { PositionRank } from '../entities/account.entity';
import { Optional } from '@nestjs/common';

export class PatchAccountRankDto {
  @IsEnum(PositionRank)
  positionRank!: PositionRank;

  @ValidateIf((o) => o.positionRank === PositionRank.TEAM_LEADER)
  @IsString()
  @Optional()
  teamName?: string;
}
