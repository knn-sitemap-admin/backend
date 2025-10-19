import { PartialType } from '@nestjs/swagger';
import { CreatePinDirectionDto } from './create-pin-direction.dto';

export class UpdatePinDirectionDto extends PartialType(CreatePinDirectionDto) {}
