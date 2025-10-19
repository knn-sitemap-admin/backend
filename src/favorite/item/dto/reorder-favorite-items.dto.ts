import {
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsNumber,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

class ReorderItem {
  @IsString()
  itemId!: string;

  @IsNumber()
  sortOrder!: number;
}

export class ReorderFavoriteItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderItem)
  orders!: ReorderItem[];
}
