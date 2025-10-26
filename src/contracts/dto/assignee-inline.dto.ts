import { PartialType } from '@nestjs/swagger';
import { CreateContractAssigneeDto } from '../assignees/dto/create-assignee.dto';
import { IsIn, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAssigneeInlineDto extends PartialType(
  CreateContractAssigneeDto,
) {
  @IsIn(['company', 'staff'])
  role!: 'company' | 'staff';

  @Type(() => Number)
  @IsNumber()
  sharePercent!: number; // 0~100
}
