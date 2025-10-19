import { PartialType } from '@nestjs/swagger';
import { CreateContractAssigneeDto } from './create-assignee.dto';

export class UpdateContractAssigneeDto extends PartialType(
  CreateContractAssigneeDto,
) {}
