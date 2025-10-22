import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, DataSource, DeepPartial, In } from 'typeorm';
import { MapPinsDto } from './dto/map-pins.dto';
import { Pin } from './entities/pin.entity';
import { CreatePinDto } from './dto/create-pin.dto';
import { UnitsService } from '../units/units.service';
import { PinDirectionsService } from '../pin-directions/pin-directions.service';
import { PinOptionsService } from '../pin-options/pin-options.service';
import { PinAreaGroupsService } from '../pin_area_groups/pin_area_groups.service';
import { PinResponseDto } from './dto/pin-detail.dto';
import { UpdatePinDto } from './dto/update-pin.dto';
import { SearchPinsDto } from './dto/search-pins.dto';
import { PinDraft } from '../../survey-reservations/entities/pin-draft.entity';
import { SurveyReservation } from '../../common/entities/survey-reservation.entity';

// type ClusterResp = {
//   mode: 'cluster';
//   clusters: Array<{ lat: number; lng: number; count: number }>;
// };

export const decimalToNumber = {
  to: (v?: number | null) => v,
  from: (v: string | null) => (v == null ? null : Number(v)),
};

type DraftMarker = {
  id: string;
  lat: number;
  lng: number;
  draftState: 'BEFORE' | 'SCHEDULED';
};

type PointResp = {
  mode: 'point';
  points: { id: string; lat: number; lng: number; badge: string | null }[];
  drafts: DraftMarker[];
};

type DraftSearchItem = {
  id: string;
  lat: number;
  lng: number;
  addressLine: string;
  draftState: 'BEFORE' | 'SCHEDULED';
};

type SearchResp = {
  pins: PinResponseDto[];
  drafts: DraftSearchItem[];
};

@Injectable()
export class PinsService {
  constructor(
    @InjectRepository(Pin)
    private readonly pinRepository: Repository<Pin>,
    private readonly dataSource: DataSource,
    private readonly unitsService: UnitsService,
    private readonly pinDirectionsService: PinDirectionsService,
    private readonly pinAreaGroupsService: PinAreaGroupsService,
    private readonly pinOptionsService: PinOptionsService,
  ) {}

  async getMapPins(dto: MapPinsDto): Promise<PointResp> {
    try {
      const { swLat, swLng, neLat, neLng, isOld, isNew, favoriteOnly } = dto;

      const qb = this.pinRepository
        .createQueryBuilder('p')
        .select(['p.id AS id', 'p.lat AS lat', 'p.lng AS lng'])
        .where('CAST(p.lat AS DECIMAL(10,6)) BETWEEN :swLat AND :neLat', {
          swLat,
          neLat,
        })
        .andWhere('CAST(p.lng AS DECIMAL(10,6)) BETWEEN :swLng AND :neLng', {
          swLng,
          neLng,
        });

      if (typeof isOld === 'boolean')
        qb.andWhere('p.isOld = :isOld', { isOld });
      if (typeof isNew === 'boolean')
        qb.andWhere('p.isNew = :isNew', { isNew });
      if (favoriteOnly) {
        // 즐겨찾기 기능 미구현 → 무시
      }

      const points = await qb
        .select([
          'p.id AS id',
          'p.lat AS lat',
          'p.lng AS lng',
          'p.badge AS badge',
          'p.name AS name',
        ])
        .orderBy('p.id', 'DESC')
        .getRawMany();

      const draftRepo = this.pinRepository.manager.getRepository(PinDraft);

      const draftsRaw = await draftRepo
        .createQueryBuilder('d')
        .select(['d.id AS id', 'd.lat AS lat', 'd.lng AS lng'])
        .where('d.isActive = 1')
        .andWhere('CAST(d.lat AS DECIMAL(10,6)) BETWEEN :swLat AND :neLat', {
          swLat,
          neLat,
        })
        .andWhere('CAST(d.lng AS DECIMAL(10,6)) BETWEEN :swLng AND :neLng', {
          swLng,
          neLng,
        })
        .orderBy('d.createdAt', 'DESC')
        .getRawMany();

      const draftIds = draftsRaw.map((d) => d.id);
      let drafts: DraftMarker[] = [];

      if (draftIds.length > 0) {
        const resvRepo =
          this.pinRepository.manager.getRepository(SurveyReservation);
        const resvRows = await resvRepo
          .createQueryBuilder('r')
          .select('r.pin_draft_id', 'pinDraftId')
          .where('r.pin_draft_id IN (:...ids)', { ids: draftIds })
          .andWhere('r.isDeleted = 0')
          .groupBy('r.pin_draft_id')
          .getRawMany();

        const hasResv = new Set(resvRows.map((r) => String(r.pinDraftId)));
        drafts = draftsRaw.map((d) => ({
          id: String(d.id),
          lat: Number(d.lat),
          lng: Number(d.lng),
          draftState: hasResv.has(String(d.id)) ? 'SCHEDULED' : 'BEFORE',
        }));
      }

      return {
        mode: 'point',
        points: points.map((p) => ({
          id: String(p.id),
          lat: Number(p.lat),
          lng: Number(p.lng),
          badge: p.badge,
          name: p.name ?? null,
        })),
        drafts,
      };
    } catch (err) {
      console.error('getMapPins ERROR:', err.message);
      console.error(err.stack);
      throw err;
    }
  }

  // 서버 클러스터링 로직
  // private async buildClusters(baseQb: SelectQueryBuilder<Pin>): Promise<Array<{ lat: number; lng: number; count: number }>> {
  //   const raw = await baseQb
  //     .select([
  //       'p.lat AS lat',
  //       'p.lng AS lng',
  //     ])
  //     .getRawMany<{ lat: string; lng: string }>();
  //
  //   const cellSize = 0.01;
  //   const map = new Map<string, { latSum: number; lngSum: number; count: number }>();
  //
  //   for (const r of raw) {
  //     const lat = Number(r.lat);
  //     const lng = Number(r.lng);
  //     const key = `${Math.floor(lat / cellSize)}:${Math.floor(lng / cellSize)}`;
  //     const prev = map.get(key);
  //     if (prev) {
  //       prev.latSum += lat;
  //       prev.lngSum += lng;
  //       prev.count += 1;
  //     } else {
  //       map.set(key, { latSum: lat, lngSum: lng, count: 1 });
  //     }
  //   }
  //
  //   return Array.from(map.values()).map((c) => ({
  //     lat: c.latSum / c.count,
  //     lng: c.lngSum / c.count,
  //     count: c.count,
  //   }));
  // }

  async create(dto: CreatePinDto) {
    // 좌표 1차 검증
    if (!Number.isFinite(dto.lat) || !Number.isFinite(dto.lng)) {
      throw new BadRequestException('잘못된 좌표');
    }

    return this.dataSource.transaction(async (manager) => {
      const pinRepo = manager.getRepository(Pin);

      // 임시핀 자동 매칭
      // 해당 로직 추후 수정 필요
      const EPS = 0.00001; // 오차범위
      const draftRepo = manager.getRepository(PinDraft);

      const candidate = await draftRepo
        .createQueryBuilder('d')
        .where('d.isActive = 1')
        .andWhere('d.lat BETWEEN :latMin AND :latMax', {
          latMin: dto.lat - EPS,
          latMax: dto.lat + EPS,
        })
        .andWhere('d.lng BETWEEN :lngMin AND :lngMax', {
          lngMin: dto.lng - EPS,
          lngMax: dto.lng + EPS,
        })
        .orderBy('d.createdAt', 'DESC')
        .setLock('pessimistic_write')
        .getOne();

      // 핀 저장
      const pin = pinRepo.create({
        lat: String(dto.lat),
        lng: String(dto.lng),
        badge: dto.badge ?? null,
        addressLine: dto.addressLine,
        name: dto.name,
        completionDate: dto.completionDate
          ? new Date(dto.completionDate)
          : null,
        buildingType: dto.buildingType ?? null,
        hasElevator: dto.hasElevator ?? null,
        totalHouseholds: dto.totalHouseholds ?? null,
        totalParkingSlots: dto.totalParkingSlots ?? null,
        registrationTypeId: dto.registrationTypeId ?? null,
        parkingTypeId: dto.parkingTypeId ?? null,
        parkingGrade: dto.parkingGrade ?? null,
        slopeGrade: dto.slopeGrade ?? null,
        structureGrade: dto.structureGrade ?? null,
        contactMainLabel: dto.contactMainLabel,
        contactMainPhone: dto.contactMainPhone,
        contactSubLabel: dto.contactSubLabel ?? null,
        contactSubPhone: dto.contactSubPhone ?? null,
        isOld: dto.isOld ?? false,
        isNew: dto.isNew ?? false,
        publicMemo: dto.publicMemo ?? null,
        privateMemo: dto.privateMemo ?? null,
      } as DeepPartial<Pin>);

      await pinRepo.save(pin);

      // 옵션/방향/면적그룹/유닛
      if (dto.options) {
        await this.pinOptionsService.upsertWithManager(
          manager,
          pin.id,
          dto.options,
        );
      } else {
        await this.pinOptionsService.ensureExistsWithDefaults(manager, pin.id);
      }

      if (Array.isArray(dto.directions)) {
        const norm = dto.directions
          .map((d) => ({ direction: (d.direction ?? '').trim() }))
          .filter((d) => d.direction.length > 0);
        const unique = Array.from(
          new Map(norm.map((x) => [x.direction, x])).values(),
        );
        await this.pinDirectionsService.replaceForPinWithManager(
          manager,
          pin.id,
          unique,
        );
      }

      if (Array.isArray(dto.areaGroups)) {
        await this.pinAreaGroupsService.replaceForPinWithManager(
          manager,
          pin.id,
          dto.areaGroups,
        );
      }

      if (Array.isArray(dto.units) && dto.units.length > 0) {
        await this.unitsService.bulkCreateWithManager(
          manager,
          pin.id,
          dto.units,
        );
      }

      // 매칭된 임시핀 있으면 비활성화(승격 처리)
      if (candidate) {
        await draftRepo.update(candidate.id, {
          isActive: false,
        });
      }

      return { id: String(pin.id), matchedDraftId: candidate?.id ?? null };
    });
  }

  async findDetail(id: string): Promise<PinResponseDto> {
    const pin = await this.pinRepository.findOneOrFail({
      where: { id },
      relations: ['options', 'directions', 'areaGroups', 'units'],
    });
    return PinResponseDto.fromEntity(pin);
  }

  async update(id: string, dto: UpdatePinDto) {
    return this.dataSource.transaction(async (manager) => {
      const pinRepo = manager.getRepository(Pin);
      const pin = await pinRepo.findOne({ where: { id } });
      if (!pin) throw new NotFoundException('핀 없음');

      // 좌표
      if (dto.lat !== undefined) {
        if (!Number.isFinite(dto.lat))
          throw new BadRequestException('잘못된 좌표');
        pin.lat = String(dto.lat);
      }
      if (dto.lng !== undefined) {
        if (!Number.isFinite(dto.lng))
          throw new BadRequestException('잘못된 lng');
        pin.lng = String(dto.lng);
      }

      // 기본 정보
      if (dto.addressLine !== undefined) pin.addressLine = dto.addressLine;
      if (dto.name !== undefined) pin.name = dto.name ?? null;

      // 건물 정보
      if (dto.completionDate !== undefined) {
        pin.completionDate = dto.completionDate
          ? new Date(dto.completionDate)
          : null;
      }
      if (dto.buildingType !== undefined)
        pin.buildingType = dto.buildingType ?? null;
      if (dto.hasElevator !== undefined) pin.hasElevator = dto.hasElevator;

      if (dto.totalHouseholds !== undefined)
        pin.totalHouseholds = dto.totalHouseholds ?? null;
      if (dto.totalParkingSlots !== undefined)
        pin.totalParkingSlots = dto.totalParkingSlots ?? null;
      if (dto.registrationTypeId !== undefined)
        pin.registrationTypeId = dto.registrationTypeId ?? null;
      if (dto.parkingTypeId !== undefined)
        pin.parkingTypeId = dto.parkingTypeId ?? null;

      if (dto.parkingGrade !== undefined)
        pin.parkingGrade = dto.parkingGrade ?? null;
      if (dto.slopeGrade !== undefined) pin.slopeGrade = dto.slopeGrade ?? null;
      if (dto.structureGrade !== undefined)
        pin.structureGrade = dto.structureGrade ?? null;

      if (dto.isOld !== undefined) pin.isOld = dto.isOld;
      if (dto.isNew !== undefined) pin.isNew = dto.isNew;

      if (dto.publicMemo !== undefined) pin.publicMemo = dto.publicMemo ?? null;
      if (dto.privateMemo !== undefined)
        pin.privateMemo = dto.privateMemo ?? null;

      // 연락처 & 배지
      if (dto.contactMainLabel !== undefined)
        pin.contactMainLabel = dto.contactMainLabel;
      if (dto.contactMainPhone !== undefined)
        pin.contactMainPhone = dto.contactMainPhone;
      if (dto.contactSubLabel !== undefined)
        pin.contactSubLabel = dto.contactSubLabel ?? null;
      if (dto.contactSubPhone !== undefined)
        pin.contactSubPhone = dto.contactSubPhone ?? null;
      if (dto.badge !== undefined) pin.badge = dto.badge ?? null;

      await pinRepo.save(pin);

      // 옵션
      if (dto.options !== undefined) {
        if (dto.options === null) {
          pin.options = null;
          await pinRepo.save(pin);
        } else {
          await this.pinOptionsService.upsertWithManager(
            manager,
            pin.id,
            dto.options,
          );
        }
      }

      // 방향
      if (dto.directions !== undefined) {
        await this.pinDirectionsService.replaceForPinWithManager(
          manager,
          pin.id,
          dto.directions ?? [],
        );
      }

      // 면적 그룹 (범위 검증 포함)
      if (dto.areaGroups !== undefined) {
        const bad = (dto.areaGroups ?? []).find(
          (g) =>
            (g.exclusiveMinM2 != null &&
              g.exclusiveMaxM2 != null &&
              g.exclusiveMinM2 > g.exclusiveMaxM2) ||
            (g.actualMinM2 != null &&
              g.actualMaxM2 != null &&
              g.actualMinM2 > g.actualMaxM2),
        );
        if (bad) throw new BadRequestException('범위가 올바르지 않습니다.');

        await this.pinAreaGroupsService.replaceForPinWithManager(
          manager,
          pin.id,
          dto.areaGroups ?? [],
        );
      }

      // 유닛
      if (dto.units !== undefined) {
        await this.unitsService.replaceForPinWithManager(
          manager,
          pin.id,
          dto.units ?? [],
        );
      }

      return { id: String(pin.id) };
    });
  }

  // 필터링 검색
  async searchPins(dto: SearchPinsDto): Promise<SearchResp> {
    const qb = this.pinRepository
      .createQueryBuilder('p')
      .leftJoin('p.units', 'u')
      .leftJoin('p.areaGroups', 'ag')
      .where('1=1');

    // 비활성 제외
    if (this.pinRepository.metadata.findColumnWithPropertyName('isDisabled')) {
      qb.andWhere('p.isDisabled = FALSE');
    }

    // 엘리베이터
    if (typeof dto.hasElevator === 'boolean') {
      qb.andWhere('p.hasElevator = :hasElevator', {
        hasElevator: dto.hasElevator,
      });
    }

    // 구조(유닛)
    if (dto.rooms?.length) {
      qb.andWhere('u.rooms IN (:...rooms)', { rooms: dto.rooms });
    }
    if (typeof dto.hasLoft === 'boolean') {
      qb.andWhere('u.hasLoft = :hasLoft', { hasLoft: dto.hasLoft });
    }
    if (typeof dto.hasTerrace === 'boolean') {
      qb.andWhere('u.hasTerrace = :hasTerrace', { hasTerrace: dto.hasTerrace });
    }
    if (dto.salePriceMin != null) {
      qb.andWhere('u.salePrice >= :salePriceMin', {
        salePriceMin: dto.salePriceMin,
      });
    }
    if (dto.salePriceMax != null) {
      qb.andWhere('u.salePrice <= :salePriceMax', {
        salePriceMax: dto.salePriceMax,
      });
    }

    // 면적
    if (dto.areaMinM2 != null || dto.areaMaxM2 != null) {
      qb.andWhere(
        new Brackets((w) => {
          if (dto.areaMinM2 != null) {
            w.andWhere(
              new Brackets((w2) => {
                w2.where(
                  '(ag.exclusiveMaxM2 IS NOT NULL AND ag.exclusiveMaxM2 >= :amin)',
                  { amin: dto.areaMinM2 },
                ).orWhere(
                  '(ag.actualMaxM2 IS NOT NULL AND ag.actualMaxM2 >= :amin)',
                  { amin: dto.areaMinM2 },
                );
              }),
            );
          }
          if (dto.areaMaxM2 != null) {
            w.andWhere(
              new Brackets((w2) => {
                w2.where(
                  '(ag.exclusiveMinM2 IS NOT NULL AND ag.exclusiveMinM2 <= :amax)',
                  { amax: dto.areaMaxM2 },
                ).orWhere(
                  '(ag.actualMinM2 IS NOT NULL AND ag.actualMinM2 <= :amax)',
                  { amax: dto.areaMaxM2 },
                );
              }),
            );
          }
        }),
      );
    }

    // 중복 핀 제거
    const rows = await qb
      .select(['p.id AS p_id'])
      .groupBy('p.id')
      .orderBy('p.id', 'DESC')
      .getRawMany<{ p_id: string }>();

    const ids = rows.map((r) => r.p_id);
    let pins: PinResponseDto[] = [];

    if (ids.length) {
      const entities = await this.pinRepository.find({
        where: { id: In(ids) },
        relations: ['options', 'directions', 'areaGroups', 'units'],
        order: { id: 'DESC' },
      });
      pins = entities.map((p) => PinResponseDto.fromEntity(p));
    }

    // 임시핀
    const hasAnyFilter =
      typeof dto.hasElevator === 'boolean' ||
      (dto.rooms?.length ?? 0) > 0 ||
      typeof dto.hasLoft === 'boolean' ||
      typeof dto.hasTerrace === 'boolean' ||
      dto.salePriceMin != null ||
      dto.salePriceMax != null ||
      dto.areaMinM2 != null ||
      dto.areaMaxM2 != null;

    let drafts: DraftSearchItem[] = [];

    if (!hasAnyFilter) {
      const draftRepo = this.pinRepository.manager.getRepository(PinDraft);
      const draftsRaw = await draftRepo
        .createQueryBuilder('d')
        .select([
          'd.id AS id',
          'd.lat AS lat',
          'd.lng AS lng',
          'd.addressLine AS addressLine',
        ])
        .where('d.isActive = 1')
        .orderBy('d.createdAt', 'DESC')
        .getRawMany<{
          id: string;
          lat: string;
          lng: string;
          addressLine: string;
        }>();

      const draftIds = draftsRaw.map((d) => d.id);
      if (draftIds.length) {
        const resvRepo =
          this.pinRepository.manager.getRepository(SurveyReservation);
        const resvRows = await resvRepo
          .createQueryBuilder('r')
          .select(['r.pinDraft AS pinDraftId'])
          .where('r.pinDraft IN (:...ids)', { ids: draftIds })
          .andWhere('r.isDeleted = 0')
          .groupBy('r.pinDraft')
          .getRawMany<{ pinDraftId: string }>();

        const hasResv = new Set(resvRows.map((r) => String(r.pinDraftId)));
        drafts = draftsRaw.map((d) => ({
          id: String(d.id),
          lat: Number(d.lat),
          lng: Number(d.lng),
          addressLine: d.addressLine,
          draftState: hasResv.has(String(d.id)) ? 'SCHEDULED' : 'BEFORE',
        }));
      }
    }
    return { pins, drafts };
  }

  // 핀 비활성
  async setDisabled(id: number, isDisabled: boolean) {
    return this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(Pin);

      // 컬럼 존재 확인
      const col = repo.metadata.findColumnWithPropertyName('isDisabled');
      if (!col) throw new BadRequestException('isDisabled 컬럼이 없습니다.');

      const pin = await repo.findOne({ where: { id: String(id) } });
      if (!pin) throw new NotFoundException('핀을 찾을 수 없습니다.');

      const already = pin.isDisabled === isDisabled;
      if (!already) {
        await repo.update(String(id), { isDisabled });
      }

      return {
        id: String(id),
        isDisabled,
        changed: !already,
      };
    });
  }
}
