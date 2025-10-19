import { DataSource } from 'typeorm';
import { BadRequestException, Injectable } from '@nestjs/common';
import { CreatePinAreaGroupDto } from './dto/create-pin_area_group.dto';
import { PinAreaGroup } from './entities/pin_area_group.entity';

@Injectable()
export class PinAreaGroupsService {
  constructor(private readonly dataSource: DataSource) {}

  async replaceForPinWithManager(
    manager: DataSource['manager'],
    pinId: string,
    newPinAreaGroups: CreatePinAreaGroupDto[] = [],
  ): Promise<void> {
    const pinAreaGroupRepository = manager.getRepository(PinAreaGroup);

    // 기존 전부 제거
    await pinAreaGroupRepository.delete({ pinId });

    if (!Array.isArray(newPinAreaGroups) || newPinAreaGroups.length === 0)
      return;

    const rows = newPinAreaGroups
      .map((d, idx) => {
        const exMin = d.exclusiveMinM2 ?? null;
        const exMax = d.exclusiveMaxM2 ?? null;
        const acMin = d.actualMinM2 ?? null;
        const acMax = d.actualMaxM2 ?? null;

        // 전용/실평 모두 비어있으면 저장 스킵
        const emptyExclusive = exMin == null && exMax == null;
        const emptyActual = acMin == null && acMax == null;
        if (emptyExclusive && emptyActual) return null;

        // min <= max 이어야 함
        if (exMin != null && exMax != null && exMin > exMax) {
          throw new BadRequestException(
            `areaGroups[${idx}] exclusiveMinM2 > exclusiveMaxM2`,
          );
        }
        if (acMin != null && acMax != null && acMin > acMax) {
          throw new BadRequestException(
            `areaGroups[${idx}] actualMinM2 > actualMaxM2`,
          );
        }

        return pinAreaGroupRepository.create({
          pinId,
          title: d.title?.trim() || null,
          exclusiveMinM2: exMin,
          exclusiveMaxM2: exMax,
          actualMinM2: acMin,
          actualMaxM2: acMax,
          sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : idx,
        } as PinAreaGroup);
      })
      .filter((x): x is PinAreaGroup => x !== null);

    if (rows.length === 0) return; // 모두 빈 카드였던 케이스

    await pinAreaGroupRepository.save(rows);
  }
}
