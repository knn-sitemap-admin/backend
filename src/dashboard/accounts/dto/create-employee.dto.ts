import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CreateTeamAssignDto } from './create-team-assign.dto';

export class CreateEmployeeDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password!: string;

  @IsEnum(['manager', 'staff'])
  role!: 'manager' | 'staff';

  @IsOptional()
  @IsBoolean()
  isDisabled?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateTeamAssignDto)
  team?: CreateTeamAssignDto;
}
