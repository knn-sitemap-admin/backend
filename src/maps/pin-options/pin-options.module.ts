import { Module } from '@nestjs/common';
import { PinOptionsService } from './pin-options.service';
import { PinOptionsController } from './pin-options.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PinOption } from './entities/pin-option.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PinOption])],
  controllers: [PinOptionsController],
  providers: [PinOptionsService],
  exports: [PinOptionsService],
})
export class PinOptionsModule {}
