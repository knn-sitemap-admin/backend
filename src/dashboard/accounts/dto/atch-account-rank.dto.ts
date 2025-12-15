import { IsEnum } from 'class-validator';
import { PositionRank } from '../entities/account.entity';

export class PatchAccountRankDto {
  @IsEnum(PositionRank)
  positionRank!: PositionRank;
}
