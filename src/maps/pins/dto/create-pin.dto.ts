import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Length,
  Min,
  Max,
  ValidateNested,
  IsArray,
  IsNotEmpty,
  IsEnum,
  IsInt,
} from 'class-validator';
import { CreateUnitDto } from '../../units/dto/create-unit.dto';
import { CreatePinOptionsDto } from '../../pin-options/dto/create-pin-option.dto';
import { CreatePinDirectionDto } from '../../pin-directions/dto/create-pin-direction.dto';
import { CreatePinAreaGroupDto } from '../../pin_area_groups/dto/create-pin_area_group.dto';
import { BuildingType, Grade3, PinBadge } from '../entities/pin.entity';

export class CreatePinDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsString()
  @Length(1, 255)
  name!: string;

  @IsOptional()
  @IsEnum(PinBadge)
  badge?: PinBadge;

  @IsString()
  @Length(1, 255)
  addressLine!: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  contactMainLabel?: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  contactMainPhone!: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  contactSubLabel?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  contactSubPhone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalBuildings?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalFloors?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  remainingHouseholds?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minRealMoveInCost?: number | null;

  // 추가된 필드들
  @IsOptional()
  @Type(() => Date)
  completionDate?: Date | null;

  @IsOptional()
  @IsEnum(['APT', 'OP', '주택', '근생', '도생'])
  buildingType?: BuildingType | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalHouseholds?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalParkingSlots?: number | null;

  @IsOptional()
  @IsInt()
  registrationTypeId?: number | null;

  @IsOptional()
  @IsInt()
  parkingTypeId?: number | null;

  @IsOptional()
  @IsEnum(['1', '2', '3', '4', '5'])
  parkingGrade?: string | null;

  @IsOptional()
  @IsEnum(['상', '중', '하'])
  slopeGrade?: Grade3 | null;

  @IsOptional()
  @IsEnum(['상', '중', '하'])
  structureGrade?: Grade3 | null;

  @IsOptional()
  @IsBoolean()
  hasElevator?: boolean;

  @IsOptional()
  @IsBoolean()
  isOld?: boolean;

  @IsOptional()
  @IsBoolean()
  isNew?: boolean;

  @IsOptional()
  @IsString()
  publicMemo?: string | null;

  @IsOptional()
  @IsString()
  privateMemo?: string | null;

  // 옵션/유닛/방향/면적그룹
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePinOptionsDto)
  options?: CreatePinOptionsDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateUnitDto)
  units?: CreateUnitDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePinDirectionDto)
  directions?: CreatePinDirectionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePinAreaGroupDto)
  areaGroups?: CreatePinAreaGroupDto[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pinDraftId?: number;
}
