import { IsOptional, IsString, Length, IsNumberString } from 'class-validator';

export class UpsertFavoriteItemDto {
  @IsOptional()
  @IsNumberString()
  groupId?: string; // 기존 그룹에 추가할 경우

  @IsOptional()
  @IsString()
  @Length(1, 32)
  title?: string; // 새 그룹 만들 때만

  @IsNumberString()
  pinId!: string;

  @IsOptional()
  sortOrder?: number; // 특정 위치에 끼워넣기
}
