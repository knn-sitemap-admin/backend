import { Module } from '@nestjs/common';
import { PinsService } from './pins.service';
import { PinsController } from './pins.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pin } from './entities/pin.entity';
import { PinDirectionsModule } from '../pin-directions/pin-directions.module';
import { UnitsModule } from '../units/units.module';
import { PinAreaGroupsModule } from '../pin_area_groups/pin_area_groups.module';
import { PinOptionsModule } from '../pin-options/pin-options.module';
import { PinDraft } from '../../survey-reservations/entities/pin-draft.entity';
import { SurveyReservationsModule } from '../../survey-reservations/survey-reservations.module';
import { SurveyReservation } from '../../survey-reservations/entities/survey-reservation.entity';
import { SurveyPerformance } from '../../performance/entities/survey-performance.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Pin,
      PinDraft,
      SurveyReservation,
      SurveyPerformance,
    ]),
    UnitsModule,
    PinDirectionsModule,
    PinAreaGroupsModule,
    PinOptionsModule,
    SurveyReservationsModule,
  ],
  controllers: [PinsController],
  providers: [PinsService],
})
export class PinsModule {}
