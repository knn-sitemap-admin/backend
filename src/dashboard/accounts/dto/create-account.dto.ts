import {
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
  IsObject,
  ValidateIf,
  IsBoolean,
  IsOptional,
} from 'class-validator';

export class CreateAccountDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password!: string;

  @IsEnum(['admin', 'manager', 'staff'])
  role!: 'admin' | 'manager' | 'staff';

  @ValidateIf((o) => o.role !== 'admin')
  @IsObject()
  team?: { teamId: string; isPrimary?: boolean; joinedAt?: string }; // YYYY-MM-DD

  // 계정 비활성화 옵션(기본 false)
  @IsOptional()
  @IsBoolean()
  isDisabled?: boolean;
}
