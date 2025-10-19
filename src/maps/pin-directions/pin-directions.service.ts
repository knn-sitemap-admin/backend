import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PinDirection } from './entities/pin-direction.entity';
import { CreatePinDirectionDto } from './dto/create-pin-direction.dto';

@Injectable()
export class PinDirectionsService {
  constructor(
    @InjectRepository(PinDirection)
    private pinDirectionRepository: Repository<PinDirection>,
  ) {}

  async replaceForPinWithManager(
    manager: EntityManager,
    pinId: string,
    items: CreatePinDirectionDto[] = [],
  ) {
    const pinDirectionRepo = manager.getRepository(PinDirection);
    await pinDirectionRepo.delete({ pinId });
    if (!items.length) return;
    const rows = items.map((d) =>
      pinDirectionRepo.create({ pinId, direction: d.direction }),
    );
    await pinDirectionRepo.save(rows);
  }
}
