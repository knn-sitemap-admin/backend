import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { CreatePinDto } from './create-pin.dto';
import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreatePinOptionsDto } from '../../pin-options/dto/create-pin-option.dto';
import { CreatePinDirectionDto } from '../../pin-directions/dto/create-pin-direction.dto';
import { CreatePinAreaGroupDto } from '../../pin_area_groups/dto/create-pin_area_group.dto';
import { CreateUnitDto } from '../../units/dto/create-unit.dto';

export class UpdatePinDto extends PartialType(CreatePinDto) {
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePinOptionsDto)
  options?: CreatePinOptionsDto;

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

  units?: CreateUnitDto[];
}
