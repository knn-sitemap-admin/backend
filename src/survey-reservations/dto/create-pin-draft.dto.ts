import { IsNumber, IsString } from 'class-validator';

export class CreatePinDraftDto {
  @IsNumber() lat!: number;
  @IsNumber() lng!: number;
  @IsString() addressLine!: string;
}
