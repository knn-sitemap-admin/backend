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

    await repo.save(
      repo.create({
        pinId,
        kitchenLayout: null,
        fridgeSlot: null,
        sofaSize: null,
        livingRoomView: null,
      }),
    );
  }

  async upsertWithManager(
    manager: EntityManager,
    pinId: string,
    dto: CreatePinOptionsDto,
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

        kitchenLayout: dto.kitchenLayout ?? null,
        fridgeSlot: dto.fridgeSlot ?? null,
        sofaSize: dto.sofaSize ?? null,
        livingRoomView: dto.livingRoomView ?? null,

        hasIslandTable: dto.hasIslandTable ?? false,
        hasKitchenWindow: dto.hasKitchenWindow ?? false,
        hasCityGas: dto.hasCityGas ?? false,
        hasInduction: dto.hasInduction ?? false,
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

    if (dto.kitchenLayout !== undefined)
      exist.kitchenLayout = dto.kitchenLayout ?? null;
    if (dto.fridgeSlot !== undefined) exist.fridgeSlot = dto.fridgeSlot ?? null;
    if (dto.sofaSize !== undefined) exist.sofaSize = dto.sofaSize ?? null;
    if (dto.livingRoomView !== undefined)
      exist.livingRoomView = dto.livingRoomView ?? null;

    if (dto.hasIslandTable !== undefined)
      exist.hasIslandTable = dto.hasIslandTable;
    if (dto.hasKitchenWindow !== undefined)
      exist.hasKitchenWindow = dto.hasKitchenWindow;
    if (dto.hasCityGas !== undefined) exist.hasCityGas = dto.hasCityGas;
    if (dto.hasInduction !== undefined) exist.hasInduction = dto.hasInduction;

    await repo.save(exist);
  }
}
