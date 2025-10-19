import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Unit } from './entities/unit.entity';
import { CreateUnitDto } from './dto/create-unit.dto';

@Injectable()
export class UnitsService {
  constructor(
    @InjectRepository(Unit) private readonly unitRepository: Repository<Unit>,
    private readonly dataSource: DataSource,
  ) {}

  private assertPriceRange(d: CreateUnitDto) {
    if (
      typeof d.minPrice === 'number' &&
      typeof d.maxPrice === 'number' &&
      d.minPrice > d.maxPrice
    ) {
      throw new BadRequestException('minPrice가 maxPrice보다 클 수 없습니다');
    }
  }

  async bulkCreateWithManager(
    manager: DataSource['manager'],
    pinId: string,
    items: CreateUnitDto[],
  ): Promise<void> {
    if (!items?.length) return;

    const unitRepo = manager.getRepository(Unit);
    const rows = items.map((d) => {
      this.assertPriceRange(d);
      return unitRepo.create({
        pinId,
        rooms: d.rooms ?? null,
        baths: d.baths ?? null,
        hasLoft: d.hasLoft ?? null,
        hasTerrace: d.hasTerrace ?? null,
        minPrice: d.minPrice ?? null,
        maxPrice: d.maxPrice ?? null,
        note: d.note ?? null,
      });
    });

    await unitRepo.save(rows);
  }

  async replaceForPinWithManager(
    manager: DataSource['manager'],
    pinId: string,
    items: CreateUnitDto[] = [],
  ): Promise<void> {
    const repo = manager.getRepository(Unit);
    await repo.delete({ pinId });
    if (!items.length) return;

    await repo.save(
      items.map((d) => {
        this.assertPriceRange(d);
        return repo.create({
          pinId,
          rooms: d.rooms ?? null,
          baths: d.baths ?? null,
          hasLoft: d.hasLoft ?? null,
          hasTerrace: d.hasTerrace ?? null,
          minPrice: d.minPrice ?? null,
          maxPrice: d.maxPrice ?? null,
          note: d.note ?? null,
        });
      }),
    );
  }
}
