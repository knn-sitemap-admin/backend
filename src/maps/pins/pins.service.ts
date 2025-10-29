import {
  BadRequestException,
  Injectable,
  Logger,
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
import { SurveyReservationsService } from '../../survey-reservations/survey-reservations.service';

// type ClusterResp = {
//   mode: 'cluster';
//   clusters: Array<{ lat: number; lng: number; count: number }>;
// };

export const decimalToNumber = {
  to: (v?: number | null) => v,
  from: (v: string | null) => (v == null ? null : Number(v)),
};

type PinMapItem = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  badge: string | null;
  addressLine: string;
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
  // private readonly logger = new Logger(PinsService.name);

  constructor(
    @InjectRepository(Pin)
    private readonly pinRepository: Repository<Pin>,
    private readonly dataSource: DataSource,
    private readonly unitsService: UnitsService,
    private readonly pinDirectionsService: PinDirectionsService,
    private readonly pinAreaGroupsService: PinAreaGroupsService,
    private readonly pinOptionsService: PinOptionsService,
    private readonly surveyReservationsService: SurveyReservationsService,
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
        // 즐겨찾기 기능 미구현
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
      const draftRepo = manager.getRepository(PinDraft);

      // 1) 임시핀 매칭: 명시적 pinDraftId 우선
      let candidate: PinDraft | null = null;

      if (dto.pinDraftId != null) {
        candidate = await draftRepo.findOne({
          where: { id: String(dto.pinDraftId), isActive: true },
        });
        if (!candidate) {
          throw new BadRequestException(
            '활성 임시핀(pinDraftId)을 찾을 수 없습니다.',
          );
        }
      } else {
        // 2) 기존 EPS 근사 fallback
        const EPS = 0.00001;
        candidate = await draftRepo
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
      }

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
        contactMainLabel: dto.contactMainLabel ?? null,
        contactMainPhone: dto.contactMainPhone,
        contactSubLabel: dto.contactSubLabel ?? null,
        contactSubPhone: dto.contactSubPhone ?? null,
        isOld: dto.isOld ?? false,
        isNew: dto.isNew ?? false,
        publicMemo: dto.publicMemo ?? null,
        privateMemo: dto.privateMemo ?? null,

        totalBuildings: dto.totalBuildings ?? null,
        totalFloors: dto.totalFloors ?? null,
        remainingHouseholds: dto.remainingHouseholds ?? null,
        minRealMoveInCost: dto.minRealMoveInCost ?? null,
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
        await draftRepo.update(candidate.id, { isActive: false });
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
        pin.contactMainLabel = dto.contactMainLabel ?? null;
      if (dto.contactMainPhone !== undefined)
        pin.contactMainPhone = dto.contactMainPhone;
      if (dto.contactSubLabel !== undefined)
        pin.contactSubLabel = dto.contactSubLabel ?? null;
      if (dto.contactSubPhone !== undefined)
        pin.contactSubPhone = dto.contactSubPhone ?? null;
      if (dto.badge !== undefined) pin.badge = dto.badge ?? null;

      if (dto.totalBuildings !== undefined)
        pin.totalBuildings = dto.totalBuildings ?? null;
      if (dto.totalFloors !== undefined)
        pin.totalFloors = dto.totalFloors ?? null;
      if (dto.remainingHouseholds !== undefined)
        pin.remainingHouseholds = dto.remainingHouseholds ?? null;
      if (dto.minRealMoveInCost !== undefined) {
        pin.minRealMoveInCost =
          dto.minRealMoveInCost == null ? null : String(dto.minRealMoveInCost);
      }

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

  async searchPins(
    dto: SearchPinsDto,
    meCredentialId = '',
    isAuthed = false,
  ): Promise<{ pins: PinMapItem[]; drafts: DraftSearchItem[] }> {
    const qb = this.pinRepository
      .createQueryBuilder('p')
      .leftJoin('p.units', 'u')
      .leftJoin('p.areaGroups', 'ag')
      .where('p.is_disabled = :active', { active: 0 });

    if (typeof dto.hasElevator === 'boolean') {
      qb.andWhere('p.has_elevator = :hasElevator', {
        hasElevator: dto.hasElevator ? 1 : 0,
      });
    }
    if (dto.rooms?.length)
      qb.andWhere('u.rooms IN (:...rooms)', { rooms: dto.rooms });
    if (typeof dto.hasLoft === 'boolean')
      qb.andWhere('u.has_loft = :hasLoft', { hasLoft: dto.hasLoft ? 1 : 0 });
    if (typeof dto.hasTerrace === 'boolean')
      qb.andWhere('u.has_terrace = :hasTerrace', {
        hasTerrace: dto.hasTerrace ? 1 : 0,
      });
    if (dto.salePriceMin != null)
      qb.andWhere('u.min_price >= :priceMin', { priceMin: dto.salePriceMin });
    if (dto.salePriceMax != null)
      qb.andWhere('u.max_price <= :priceMax', { priceMax: dto.salePriceMax });

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

    const idRows = await qb
      .select('p.id', 'id')
      .groupBy('p.id')
      .orderBy('p.id', 'DESC')
      .getRawMany<{ id: string }>();

    const ids = idRows.map((r) => Number(r.id)).filter(Number.isFinite);

    let pins: PinMapItem[] = [];
    if (ids.length) {
      const raw = await this.pinRepository
        .createQueryBuilder('p')
        .select([
          'p.id AS id',
          'p.lat AS lat',
          'p.lng AS lng',
          'p.name AS name',
          'p.badge AS badge',
          'p.address_line AS addressLine',
        ])
        .where('p.id IN (:...ids)', { ids })
        .orderBy('p.id', 'DESC')
        .getRawMany<{
          id: string | number;
          lat: string | number;
          lng: string | number;
          name: string;
          badge: string | null;
          addressLine: string;
        }>();

      pins = raw.map((r) => ({
        id: String(r.id),
        lat: Number(r.lat),
        lng: Number(r.lng),
        name: r.name,
        badge: r.badge ?? null,
        addressLine: r.addressLine,
      }));
    }

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
        .where('d.isActive = :active', { active: 1 })
        .orderBy('d.createdAt', 'DESC')
        .limit(100)
        .getRawMany<{
          id: string;
          lat: string;
          lng: string;
          addressLine: string;
        }>();

      const draftIds = draftsRaw.map((d) => d.id);

      const resvRepo =
        this.pinRepository.manager.getRepository(SurveyReservation);
      const resvRows = draftIds.length
        ? await resvRepo
            .createQueryBuilder('r')
            .select(['r.pinDraft AS pinDraftId', 'r.assignee_id AS assigneeId'])
            .where('r.pinDraft IN (:...ids)', { ids: draftIds })
            .andWhere('r.isDeleted = :isDeleted', { isDeleted: 0 })
            .getRawMany<{ pinDraftId: string; assigneeId: string }>()
        : [];

      const assigneesByDraft = resvRows.reduce((map, r) => {
        const k = String(r.pinDraftId);
        const set = map.get(k) ?? new Set<string>();
        if (r.assigneeId != null) set.add(String(r.assigneeId));
        map.set(k, set);
        return map;
      }, new Map<string, Set<string>>());

      let myAccountId: string | null = null;
      if (isAuthed && meCredentialId) {
        try {
          myAccountId =
            await this.surveyReservationsService.resolveMyAccountId(
              meCredentialId,
            );
        } catch {
          myAccountId = null;
        }
      }

      drafts = draftsRaw
        .map((d) => {
          const assignees =
            assigneesByDraft.get(String(d.id)) ?? new Set<string>();
          const hasReservation = assignees.size > 0;
          const isMine = !!myAccountId && assignees.has(String(myAccountId));
          if (!hasReservation) {
            return {
              id: String(d.id),
              lat: Number(d.lat),
              lng: Number(d.lng),
              addressLine: d.addressLine,
              draftState: 'BEFORE' as const,
            };
          }
          if (isMine) {
            return {
              id: String(d.id),
              lat: Number(d.lat),
              lng: Number(d.lng),
              addressLine: d.addressLine,
              draftState: 'SCHEDULED' as const,
            };
          }
          return null;
        })
        .filter((x): x is DraftSearchItem => x !== null);
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
