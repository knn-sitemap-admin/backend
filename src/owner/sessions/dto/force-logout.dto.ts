import { IsEnum, IsString } from 'class-validator';

export class ForceLogoutDto {
  @IsString()
  credentialId!: string;

  @IsEnum(['pc', 'mobile', 'all'] as const)
  deviceType!: 'pc' | 'mobile' | 'all';
}
