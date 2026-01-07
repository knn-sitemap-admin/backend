import {
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
  positionRank?: PositionRank;

  @IsOptional()
  @IsUrl()
  docUrlResidentRegistration?: string | null; // 등본

  @IsOptional()
  @IsUrl()
  docUrlResidentAbstract?: string | null; // 초본

  @IsOptional()
  @IsUrl()
  docUrlIdCard?: string | null; // 신분증

  @IsOptional()
  @IsUrl()
  docUrlFamilyRelation?: string | null; // 가족관계증명서
}
