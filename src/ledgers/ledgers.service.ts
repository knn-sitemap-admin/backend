import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Ledger } from './entities/ledgers.entity';

@Injectable()
export class LedgersService {
  constructor(
    @InjectRepository(Ledger)
    private readonly ledgerRepository: Repository<Ledger>,
  ) {}

  async findAll(credentialId: string): Promise<Ledger[]> {
    return this.ledgerRepository.find({
      where: { credentialId },
      order: { entryDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async create(credentialId: string, dto: any): Promise<Ledger> {
    const ledger = this.ledgerRepository.create({
      ...dto,
      credentialId,
    } as DeepPartial<Ledger>);
    return this.ledgerRepository.save(ledger);
  }

  async update(id: number, credentialId: string, dto: any): Promise<Ledger> {
    const ledger = await this.ledgerRepository.findOne({
      where: { id, credentialId },
    });
    if (!ledger) {
      throw new NotFoundException('가계부 내역을 찾을 수 없습니다.');
    }
    Object.assign(ledger, dto);
    return this.ledgerRepository.save(ledger);
  }

  async remove(id: number, credentialId: string): Promise<void> {
    const result = await this.ledgerRepository.delete({ id, credentialId });
    if (result.affected === 0) {
      throw new NotFoundException('가계부 내역을 찾을 수 없습니다.');
    }
  }
}
