import { IsEnum, IsOptional, IsString } from 'class-validator';

export type ForceLogoutDeviceType = 'pc' | 'mobile' | 'all';

export class ForceLogoutDto {
  @IsString()
  credentialId!: string;

  @IsOptional()
  @IsEnum(['pc', 'mobile', 'all'] as const)
  deviceType?: ForceLogoutDeviceType;
}
