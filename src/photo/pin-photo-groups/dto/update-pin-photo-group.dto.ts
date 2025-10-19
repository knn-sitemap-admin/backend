import { IsInt, IsOptional, IsString, Length } from 'class-validator';

export class UpdatePinPhotoGroupDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  title?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
