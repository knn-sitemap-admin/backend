import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ledger } from './entities/ledgers.entity';
import { LedgersService } from './ledgers.service';
import { LedgersController } from './ledgers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Ledger])],
  controllers: [LedgersController],
  providers: [LedgersService],
  exports: [LedgersService],
})
export class LedgersModule {}
