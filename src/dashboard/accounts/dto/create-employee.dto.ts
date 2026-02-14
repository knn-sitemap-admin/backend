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
import { PositionRank } from '../entities/account.entity';
import { UpsertEmployeeInfoDto } from './upsert-employee-info.dto';

export class CreateEmployeeDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password!: string;

  // @IsOptional()
  // @IsEnum(PositionRank)
  // positionRank?: PositionRank | null;

  @IsOptional()
  @IsBoolean()
  isDisabled?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateTeamAssignDto)
  team?: CreateTeamAssignDto;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  teamName?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpsertEmployeeInfoDto)
  info?: UpsertEmployeeInfoDto;
}
