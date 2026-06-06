import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePinDraftDto {
  @IsOptional()
  @IsBoolean()
  isSalesStopped?: boolean;
}
