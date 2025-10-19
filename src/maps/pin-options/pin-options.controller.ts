import { Controller } from '@nestjs/common';
import { PinOptionsService } from './pin-options.service';

@Controller('pin-options')
export class PinOptionsController {
  constructor(private readonly pinOptionsService: PinOptionsService) {}
}
