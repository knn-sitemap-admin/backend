import { IsString, Length } from 'class-validator';

export class UpdateFavoriteGroupDto {
  @IsString()
  @Length(1, 32)
  title!: string;
}
