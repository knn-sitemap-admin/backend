import { Module } from '@nestjs/common';
import { PinDirectionsService } from './pin-directions.service';
import { PinDirectionsController } from './pin-directions.controller';
import { PinDirection } from './entities/pin-direction.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pin } from '../pins/entities/pin.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PinDirection, Pin])],
  controllers: [PinDirectionsController],
  providers: [PinDirectionsService],
  exports: [PinDirectionsService],
})
export class PinDirectionsModule {}
