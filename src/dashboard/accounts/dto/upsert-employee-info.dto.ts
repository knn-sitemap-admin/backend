import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { PositionRank } from '../entities/account.entity';

export class UpsertEmployeeInfoDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  emergencyContact?: string | null;

  @IsOptional()
  @IsString()
  addressLine?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  salaryBankName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  salaryAccount?: string | null;

  @IsOptional()
  @IsString()
  profileUrl?: string | null;

  @IsOptional()
  @IsEnum(PositionRank)
  positionRank?: PositionRank | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  teamName?: string | null;

  @IsOptional()
  @IsString()
  teamId?: string | null;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  docUrlResidentRegistration?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  docUrlResidentAbstract?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  docUrlIdCard?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  docUrlFamilyRelation?: string[] | null;
}
