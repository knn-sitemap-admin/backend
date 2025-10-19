import { Module } from '@nestjs/common';
import { PinAreaGroupsService } from './pin_area_groups.service';
import { PinAreaGroupsController } from './pin_area_groups.controller';
import { PinAreaGroup } from './entities/pin_area_group.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([PinAreaGroup])],
  controllers: [PinAreaGroupsController],
  providers: [PinAreaGroupsService],
  exports: [PinAreaGroupsService],
})
export class PinAreaGroupsModule {}
