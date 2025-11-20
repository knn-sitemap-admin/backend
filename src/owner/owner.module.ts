import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OwnerController } from './owner.controller';
import { OwnerService } from './owner.service';
import { Contract } from '../contracts/entities/contract.entity';
import { Team } from '../dashboard/accounts/entities/team.entity';
import { OwnerAuthPageController } from './owner-auth.controller';
import { OwnerAdminGuard } from './owner-admin.guard';
import { AuthModule } from '../dashboard/auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Contract, Team]), AuthModule],
  controllers: [OwnerController, OwnerAuthPageController],
  providers: [OwnerService, OwnerAdminGuard],
})
export class OwnerModule {}
