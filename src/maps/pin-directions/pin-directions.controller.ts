import { Controller } from '@nestjs/common';
import { PinDirectionsService } from './pin-directions.service';

@Controller('pin-directions')
export class PinDirectionsController {
  constructor(private readonly pinDirectionsService: PinDirectionsService) {}
}
