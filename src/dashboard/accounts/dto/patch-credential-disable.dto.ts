import { IsBoolean } from 'class-validator';

export class PatchCredentialDisableDto {
  @IsBoolean()
  disabled!: boolean;
}
