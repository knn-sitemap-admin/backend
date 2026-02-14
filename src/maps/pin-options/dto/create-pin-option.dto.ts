import {
  IsOptional,
  IsBoolean,
  IsString,
  Length,
  IsEnum,
} from 'class-validator';
import {
  FridgeSlot,
  KitchenLayout,
  LivingRoomView,
  SofaSize,
} from '../entities/pin-option.entity';

export class CreatePinOptionsDto {
  @IsOptional() @IsBoolean() hasAircon?: boolean;
  @IsOptional() @IsBoolean() hasFridge?: boolean;
  @IsOptional() @IsBoolean() hasWasher?: boolean;
  @IsOptional() @IsBoolean() hasDryer?: boolean;
  @IsOptional() @IsBoolean() hasBidet?: boolean;
  @IsOptional() @IsBoolean() hasAirPurifier?: boolean;
  @IsOptional() @IsBoolean() isDirectLease?: boolean;
  @IsOptional() @IsString() @Length(0, 255) extraOptionsText?: string;

  @IsOptional()
  @IsEnum(KitchenLayout)
  kitchenLayout?: KitchenLayout | null;

  @IsOptional()
  @IsEnum(FridgeSlot)
  fridgeSlot?: FridgeSlot | null;

  @IsOptional()
  @IsEnum(SofaSize)
  sofaSize?: SofaSize | null;

  @IsOptional()
  @IsEnum(LivingRoomView)
  livingRoomView?: LivingRoomView | null;

  // 신규 bool
  @IsOptional() @IsBoolean() hasIslandTable?: boolean;
  @IsOptional() @IsBoolean() hasKitchenWindow?: boolean;
  @IsOptional() @IsBoolean() hasCityGas?: boolean;
  @IsOptional() @IsBoolean() hasInduction?: boolean;
}
