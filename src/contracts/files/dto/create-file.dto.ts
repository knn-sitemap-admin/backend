import { IsString, MaxLength } from 'class-validator';

export class CreateContractFileDto {
  @IsString()
  url!: string;

  @MaxLength(255)
  filename?: string;
}
