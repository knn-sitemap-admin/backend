import { Module } from '@nestjs/common';
import { SurveyReservationsService } from './survey-reservations.service';
import { SurveyReservationsController } from './survey-reservations.controller';
import { PinDraft } from './entities/pin-draft.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PinDraftsController } from './pin-drafts.controller';
import { PinDraftsService } from './pin-drafts.service';
import { SurveyReservation } from './entities/survey-reservation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PinDraft, SurveyReservation])],
  controllers: [SurveyReservationsController, PinDraftsController],
  providers: [SurveyReservationsService, PinDraftsService],
})
export class SurveyReservationsModule {}
