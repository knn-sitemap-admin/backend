import { Module } from '@nestjs/common';
import { PinsService } from './pins.service';
import { PinsController } from './pins.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pin } from './entities/pin.entity';
import { PinDirectionsModule } from '../pin-directions/pin-directions.module';
import { UnitsModule } from '../units/units.module';
import { PinAreaGroupsModule } from '../pin_area_groups/pin_area_groups.module';
import { PinOptionsModule } from '../pin-options/pin-options.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pin]),
    UnitsModule,
    PinDirectionsModule,
    PinAreaGroupsModule,
    PinOptionsModule,
  ],
  controllers: [PinsController],
  providers: [PinsService],
})
export class PinsModule {}
