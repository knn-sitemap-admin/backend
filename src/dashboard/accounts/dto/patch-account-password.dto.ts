import { IsString, MinLength } from 'class-validator';

export class PatchAccountPasswordDto {
  @IsString()
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다.' })
  password!: string;
}
