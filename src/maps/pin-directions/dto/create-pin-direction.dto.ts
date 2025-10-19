import { IsString, Length } from 'class-validator';
export class CreatePinDirectionDto {
  @IsString()
  @Length(1, 10)
  direction!: string;
}
