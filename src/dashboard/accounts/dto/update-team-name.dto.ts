import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateTeamNameDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}
