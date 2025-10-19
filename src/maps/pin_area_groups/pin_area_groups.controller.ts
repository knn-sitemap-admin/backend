import { Controller } from '@nestjs/common';
import { PinAreaGroupsService } from './pin_area_groups.service';

@Controller('pin-area-groups')
export class PinAreaGroupsController {
  constructor(private readonly pinAreaGroupsService: PinAreaGroupsService) {}
}
