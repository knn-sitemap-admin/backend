import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PinOption } from './entities/pin-option.entity';
import { CreatePinOptionsDto } from './dto/create-pin-option.dto';

@Injectable()
export class PinOptionsService {
  constructor(
    @InjectRepository(PinOption)
    private readonly pinOptionRepository: Repository<PinOption>,
  ) {}

  async ensureExistsWithDefaults(
    manager: EntityManager,
    pinId: string,
  ): Promise<void> {
    const repo = manager.getRepository(PinOption);
    const exist = await repo.findOne({ where: { pinId } });
    if (exist) return;
    await repo.save(repo.create({ pinId })); // DB default=false가 채워짐
  }

  async upsertWithManager(
    manager: EntityManager,
    pinId: string,
    dto: CreatePinOptionsDto, // 이름은 Create지만 "patch"로 동작
  ): Promise<void> {
    const repo = manager.getRepository(PinOption);
    const exist = await repo.findOne({ where: { pinId } });

    if (!exist) {
      const created = repo.create({
        pinId,
        hasAircon: dto.hasAircon ?? false,
        hasFridge: dto.hasFridge ?? false,
        hasWasher: dto.hasWasher ?? false,
        hasDryer: dto.hasDryer ?? false,
        hasBidet: dto.hasBidet ?? false,
        hasAirPurifier: dto.hasAirPurifier ?? false,
        isDirectLease: dto.isDirectLease ?? false,
        extraOptionsText: dto.extraOptionsText ?? null,
      });
      await repo.save(created);
      return;
    }

    if (dto.hasAircon !== undefined) exist.hasAircon = dto.hasAircon;
    if (dto.hasFridge !== undefined) exist.hasFridge = dto.hasFridge;
    if (dto.hasWasher !== undefined) exist.hasWasher = dto.hasWasher;
    if (dto.hasDryer !== undefined) exist.hasDryer = dto.hasDryer;
    if (dto.hasBidet !== undefined) exist.hasBidet = dto.hasBidet;
    if (dto.hasAirPurifier !== undefined)
      exist.hasAirPurifier = dto.hasAirPurifier;
    if (dto.isDirectLease !== undefined)
      exist.isDirectLease = dto.isDirectLease;

    if (dto.extraOptionsText !== undefined) {
      exist.extraOptionsText = dto.extraOptionsText || null;
    }

    await repo.save(exist);
  }

  async deleteByPinWithManager(
    manager: EntityManager,
    pinId: string,
  ): Promise<void> {
    await manager.getRepository(PinOption).delete({ pinId });
  }
}
