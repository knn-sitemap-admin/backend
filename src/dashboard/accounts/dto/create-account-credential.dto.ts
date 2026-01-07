import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCredentialDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password!: string;

  @IsEnum(['admin', 'manager', 'staff'])
  role!: 'admin' | 'manager' | 'staff';

  @IsOptional()
  @IsBoolean()
  isDisabled?: boolean;
}
