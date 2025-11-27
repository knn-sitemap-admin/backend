import { IsNumber, IsOptional, IsString, Length } from 'class-validator';

export class CreatePinDraftDto {
  @IsNumber() lat!: number;
  @IsNumber() lng!: number;
  @IsString() addressLine!: string;
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  contactMainPhone?: string;
}
