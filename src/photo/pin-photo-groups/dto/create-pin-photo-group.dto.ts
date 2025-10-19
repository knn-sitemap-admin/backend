import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreatePinPhotoGroupDto {
  @IsNotEmpty()
  @IsInt()
  pinId!: string;

  @IsString()
  @Length(1, 100)
  title!: string;

  @IsOptional()
  @IsBoolean()
  isDocument?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
