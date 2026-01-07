import { PartialType } from '@nestjs/swagger';
import { CreateSurveyReservationDto } from './create-survey-reservation.dto';

export class UpdateSurveyReservationDto extends PartialType(CreateSurveyReservationDto) {}
