import { PartialType } from '@nestjs/swagger';
import { CreatePinOptionsDto } from './create-pin-option.dto';

export class UpdatePinOptionDto extends PartialType(CreatePinOptionsDto) {}
