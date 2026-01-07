import { PartialType } from '@nestjs/swagger';
import { CreatePinAreaGroupDto } from './create-pin_area_group.dto';

export class UpdatePinAreaGroupDto extends PartialType(CreatePinAreaGroupDto) {}
