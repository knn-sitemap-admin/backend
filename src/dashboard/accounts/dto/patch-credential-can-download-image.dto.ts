import { IsBoolean } from 'class-validator';

export class PatchCredentialCanDownloadImageDto {
  @IsBoolean()
  canDownloadImage!: boolean;
}
