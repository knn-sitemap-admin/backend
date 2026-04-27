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

  async findAll(credentialId: string, role?: string): Promise<Ledger[]> {
    const where = role === 'admin' ? {} : { credentialId };
    return this.ledgerRepository.find({
      where,
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

  async getYearlyStats(year: number, credentialId: string, role?: string) {
    const qb = this.ledgerRepository.createQueryBuilder('l')
      .select("CAST(SUBSTRING(l.entry_date, 6, 2) AS UNSIGNED)", 'month')
      .addSelect('SUM(l.amount)', 'totalAmount')
      .where("l.entry_date LIKE :yearPattern", { yearPattern: `${year}-%` })
      .groupBy('month')
      .orderBy('month', 'ASC');

    if (role !== 'admin') {
      qb.andWhere('l.credentialId = :credentialId', { credentialId });
    }

    const rows = await qb.getRawMany();
    return rows.map(r => {
      const entries = Object.entries(r);
      return {
        month: Number(entries[0][1]),
        totalAmount: Number(entries[1][1]),
      };
    });
  }
}
