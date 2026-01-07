import {
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsNumber,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

class ReorderGroup {
  @IsString()
  id!: string;

  @IsNumber()
  sortOrder!: number;
}

export class ReorderFavoriteGroupsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderGroup)
  orders!: ReorderGroup[];
}
