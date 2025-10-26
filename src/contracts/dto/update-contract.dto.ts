import { CreateContractDto } from './create-contract.dto';
import { PartialType } from '@nestjs/swagger';

export class UpdateContractDto extends PartialType(CreateContractDto) {}
