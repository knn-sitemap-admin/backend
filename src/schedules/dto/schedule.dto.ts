import {
  IsString,
  IsOptional,
  IsDateString,
  MaxLength,
  IsBoolean,
} from 'class-validator';

export class CreateScheduleDto {
  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsBoolean()
  @IsOptional()
  isAllDay?: boolean;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  category!: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  customerPhoneLast4?: string;

  @IsString()
  @IsOptional()
  meetingType?: string;

  @IsString()
  @IsOptional()
  createdByAccountId?: string;
}

export class UpdateScheduleDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsBoolean()
  @IsOptional()
  isAllDay?: boolean;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  customerPhoneLast4?: string;

  @IsString()
  @IsOptional()
  meetingType?: string;

  @IsString()
  @IsOptional()
  createdByAccountId?: string;
}

export class ScheduleQueryDto {
  @IsDateString()
  @IsOptional()
  from?: string;

  @IsDateString()
  @IsOptional()
  to?: string;
}
