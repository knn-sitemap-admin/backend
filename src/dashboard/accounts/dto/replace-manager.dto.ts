import { IsString } from 'class-validator';

export class ReplaceManagerDto {
  @IsString()
  newCredentialId!: string;
}
