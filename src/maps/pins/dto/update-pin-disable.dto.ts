import { Type } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class UpdatePinDisableDto {
  @Type(() => Boolean)
  @IsBoolean()
  isDisabled!: boolean;
}
