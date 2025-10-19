import { IsOptional, IsBoolean, IsString, Length } from 'class-validator';

export class CreatePinOptionsDto {
  @IsOptional() @IsBoolean() hasAircon?: boolean;
  @IsOptional() @IsBoolean() hasFridge?: boolean;
  @IsOptional() @IsBoolean() hasWasher?: boolean;
  @IsOptional() @IsBoolean() hasDryer?: boolean;
  @IsOptional() @IsBoolean() hasBidet?: boolean;
  @IsOptional() @IsBoolean() hasAirPurifier?: boolean;
  @IsOptional() @IsBoolean() isDirectLease?: boolean;
  @IsOptional() @IsString() @Length(0, 255) extraOptionsText?: string;
}
