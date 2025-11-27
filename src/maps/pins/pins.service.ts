import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, DataSource, DeepPartial } from 'typeorm';
import { MapPinsDto } from './dto/map-pins.dto';
import { Pin, PinBadge } from './entities/pin.entity';
import { CreatePinDto } from './dto/create-pin.dto';
import { UnitsService } from '../units/units.service';
import { PinDirectionsService } from '../pin-directions/pin-directions.service';
import { PinOptionsService } from '../pin-options/pin-options.service';
import { PinAreaGroupsService } from '../pin_area_groups/pin_area_groups.service';
import { PinPersonInfo, PinResponseDto } from './dto/pin-detail.dto';
import { UpdatePinDto } from './dto/update-pin.dto';
import { SearchPinsDto } from './dto/search-pins.dto';
import { PinDraft } from '../../survey-reservations/entities/pin-draft.entity';
import { SurveyReservationsService } from '../../survey-reservations/survey-reservations.service';
import { Account } from '../../dashboard/accounts/entities/account.entity';
import { SurveyReservation } from '../../survey-reservations/entities/survey-reservation.entity';

export type AgeType = 'OLD' | 'NEW' | null;

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
  points: {
    id: string;
    lat: number;
    lng: number;
    name: string | null;
    badge: string | null;
    ageType: AgeType;
  }[];
  drafts: DraftMarker[];
};

type DraftSearchItem = {
  id: string;
  lat: number;
  lng: number;
  addressLine: string;
  draftState: 'BEFORE' | 'SCHEDULED';
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

      if (typeof isOld === 'boolean') {
        qb.andWhere('p.isOld = :isOld', { isOld });
      }
      if (typeof isNew === 'boolean') {
        qb.andWhere('p.isNew = :isNew', { isNew });
      }
      if (favoriteOnly) {
        // 즐겨찾기 필터는 나중에 구현
      }

      const points = await qb
        .select([
          'p.id AS id',
          'p.lat AS lat',
          'p.lng AS lng',
          'p.badge AS badge',
          'p.name AS name',
          'p.isOld AS isOld',
          'p.isNew AS isNew',
        ])
        .orderBy('p.id', 'DESC')
        .getRawMany<{
          id: string | number;
          lat: string | number;
          lng: string | number;
          badge: string | null;
          name: string | null;
          isOld: 0 | 1 | boolean | null;
          isNew: 0 | 1 | boolean | null;
        }>();

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
          .andWhere('r.is_deleted = 0')
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
        points: points.map((p) => {
          const oldFlag = !!p.isOld;
          const newFlag = !!p.isNew;

          let ageType: AgeType = null;
          if (newFlag && !oldFlag) {
            ageType = 'NEW';
          } else if (oldFlag && !newFlag) {
            ageType = 'OLD';
          } else if (newFlag && oldFlag) {
            // 둘 다 true면 신축 우선
            ageType = 'NEW';
          }

          return {
            id: String(p.id),
            lat: Number(p.lat),
            lng: Number(p.lng),
            name: p.name ?? null,
            badge: p.badge ?? null,
            ageType,
          };
        }),
        drafts,
      };
    } catch (err: any) {
      console.error('getMapPins ERROR:', err.message);
      console.error(err.stack);
      throw err;
    }
  }

  async create(dto: CreatePinDto, meCredentialId: string | null) {
    if (!Number.isFinite(dto.lat) || !Number.isFinite(dto.lng)) {
      throw new BadRequestException('잘못된 좌표');
    }

    return this.dataSource.transaction(async (manager) => {
      const pinRepo = manager.getRepository(Pin);
      const draftRepo = manager.getRepository(PinDraft);
      const resvRepo = manager.getRepository(SurveyReservation);

      // 1) 임시핀 매칭
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

      // 2) 생성자 accountId
      let creatorAccountId: string | null = null;

      if (candidate && candidate.creatorId) {
        creatorAccountId = String(candidate.creatorId);
      } else if (meCredentialId) {
        try {
          creatorAccountId =
            await this.surveyReservationsService.resolveMyAccountId(
              meCredentialId,
            );
        } catch {
          creatorAccountId = null;
        }
      }

      // 3) 답사자 / 답사일 (예약 기준)
      let surveyedBy: string | null = null;
      let surveyedAt: Date | null = null;
      let matchedReservation: SurveyReservation | null = null;

      if (candidate) {
        matchedReservation = await resvRepo.findOne({
          where: {
            pinDraft: { id: candidate.id },
            isDeleted: false,
          },
          relations: ['assignee'],
          order: { createdAt: 'DESC' },
        });

        if (matchedReservation) {
          surveyedBy = String(matchedReservation.assignee.id);
          surveyedAt = new Date(matchedReservation.reservedDate);
        }
      }

      if (!candidate && creatorAccountId && !surveyedBy) {
        surveyedBy = creatorAccountId;
        surveyedAt = new Date();
      }

      // 4) 핀 저장
      const pin = pinRepo.create({
        lat: String(dto.lat),
        lng: String(dto.lng),
        badge: dto.badge ?? null,
        addressLine: dto.addressLine,
        name: dto.name,
        rebateText: dto.rebateText ?? null,
        completionDate: dto.completionDate
          ? new Date(dto.completionDate)
          : null,
        buildingType: dto.buildingType ?? null,
        hasElevator: dto.hasElevator ?? null,
        totalHouseholds: dto.totalHouseholds ?? null,
        totalParkingSlots: dto.totalParkingSlots ?? null,
        registrationTypeId: dto.registrationTypeId ?? null,
        parkingType: dto.parkingType ?? null,
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
        creatorId: creatorAccountId,
        surveyedBy,
        surveyedAt,
      } as DeepPartial<Pin>);

      await pinRepo.save(pin);

      // 5) 옵션/방향/면적그룹/유닛
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

      //  임시핀 비활성화
      if (candidate) {
        await draftRepo.delete(candidate.id);
      }

      // 예약도 삭제
      if (matchedReservation) {
        await resvRepo.delete(matchedReservation.id);
      }

      return {
        id: String(pin.id),
        matchedDraftId: candidate?.id ?? null,
        matchedReservationId: matchedReservation?.id ?? null,
      };
    });
  }

  async findDetail(id: string): Promise<PinResponseDto> {
    const pin = await this.pinRepository.findOne({
      where: { id },
      relations: ['options', 'directions', 'areaGroups', 'units'],
    });

    if (!pin) {
      throw new NotFoundException('핀 없음');
    }

    const accountRepo = this.dataSource.getRepository(Account);

    let creator: PinPersonInfo | null = null;
    let surveyor: PinPersonInfo | null = null;
    let lastEditor: PinPersonInfo | null = null;

    if (pin.creatorId) {
      const acc = await accountRepo.findOne({
        where: { id: String(pin.creatorId) },
      });
      if (acc) {
        creator = {
          id: String(acc.id),
          name: acc.name ?? null,
        };
      }
    }

    if (pin.surveyedBy) {
      const acc = await accountRepo.findOne({
        where: { id: String(pin.surveyedBy) },
      });
      if (acc) {
        surveyor = {
          id: String(acc.id),
          name: acc.name ?? null,
        };
      }
    }

    if (pin.lastEditorId) {
      const acc = await accountRepo.findOne({
        where: { id: String(pin.lastEditorId) },
      });
      if (acc) {
        lastEditor = {
          id: String(acc.id),
          name: acc.name ?? null,
        };
      }
    }

    return PinResponseDto.fromEntity(pin, {
      creator,
      surveyor,
      lastEditor,
    });
  }

  async update(id: string, dto: UpdatePinDto, meCredentialId: string | null) {
    return this.dataSource.transaction(async (manager) => {
      const pinRepo = manager.getRepository(Pin);
      const pin = await pinRepo.findOne({ where: { id } });
      if (!pin) throw new NotFoundException('핀 없음');

      // 좌표
      if (dto.lat !== undefined) {
        if (!Number.isFinite(dto.lat)) {
          throw new BadRequestException('잘못된 좌표');
        }
        pin.lat = String(dto.lat);
      }
      if (dto.lng !== undefined) {
        if (!Number.isFinite(dto.lng)) {
          throw new BadRequestException('잘못된 lng');
        }
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
      if (dto.buildingType !== undefined) {
        pin.buildingType = dto.buildingType ?? null;
      }
      if (dto.hasElevator !== undefined) {
        pin.hasElevator = dto.hasElevator;
      }

      if (dto.totalHouseholds !== undefined) {
        pin.totalHouseholds = dto.totalHouseholds ?? null;
      }
      if (dto.totalParkingSlots !== undefined) {
        pin.totalParkingSlots = dto.totalParkingSlots ?? null;
      }
      if (dto.registrationTypeId !== undefined) {
        pin.registrationTypeId = dto.registrationTypeId ?? null;
      }
      if (dto.parkingType !== undefined) {
        pin.parkingType = dto.parkingType ?? null;
      }

      if (dto.parkingGrade !== undefined) {
        pin.parkingGrade = dto.parkingGrade ?? null;
      }
      if (dto.slopeGrade !== undefined) {
        pin.slopeGrade = dto.slopeGrade ?? null;
      }
      if (dto.structureGrade !== undefined) {
        pin.structureGrade = dto.structureGrade ?? null;
      }

      if (dto.isOld !== undefined) {
        pin.isOld = dto.isOld;
      }
      if (dto.isNew !== undefined) {
        pin.isNew = dto.isNew;
      }

      if (dto.publicMemo !== undefined) {
        pin.publicMemo = dto.publicMemo ?? null;
      }
      if (dto.privateMemo !== undefined) {
        pin.privateMemo = dto.privateMemo ?? null;
      }

      if (dto.rebateText !== undefined) {
        pin.rebateText = dto.rebateText ?? null;
      }

      // 연락처 & 배지
      if (dto.contactMainLabel !== undefined) {
        pin.contactMainLabel = dto.contactMainLabel ?? null;
      }
      if (dto.contactMainPhone !== undefined) {
        pin.contactMainPhone = dto.contactMainPhone;
      }
      if (dto.contactSubLabel !== undefined) {
        pin.contactSubLabel = dto.contactSubLabel ?? null;
      }
      if (dto.contactSubPhone !== undefined) {
        pin.contactSubPhone = dto.contactSubPhone ?? null;
      }
      if (dto.badge !== undefined) {
        pin.badge = dto.badge ?? null;
      }

      if (dto.totalBuildings !== undefined) {
        pin.totalBuildings = dto.totalBuildings ?? null;
      }
      if (dto.totalFloors !== undefined) {
        pin.totalFloors = dto.totalFloors ?? null;
      }
      if (dto.remainingHouseholds !== undefined) {
        pin.remainingHouseholds = dto.remainingHouseholds ?? null;
      }
      if (dto.minRealMoveInCost !== undefined) {
        pin.minRealMoveInCost =
          dto.minRealMoveInCost == null ? null : String(dto.minRealMoveInCost);
      }

      if (meCredentialId) {
        try {
          const editorAccountId =
            await this.surveyReservationsService.resolveMyAccountId(
              meCredentialId,
            );
          pin.lastEditorId = editorAccountId;
        } catch {
          // 계정 못 찾으면 그냥 무시
        }
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
      .leftJoin('p.units', 'u') // 매매가 필터용
      .leftJoin('p.areaGroups', 'ag') // 면적 필터용
      .where('p.is_disabled = :active', { active: 0 });

    // 0) 방/테라스/복층 → PinBadge 배열로 변환
    const badgeFilters: PinBadge[] = [];
    const rooms = dto.rooms ?? [];
    const hasTerrace = dto.hasTerrace === true;
    const hasLoft = dto.hasLoft === true;

    if (rooms.includes(1)) {
      badgeFilters.push(
        hasTerrace ? PinBadge.R1_TO_1_5_TERRACE : PinBadge.R1_TO_1_5,
      );
    }
    if (rooms.includes(2)) {
      badgeFilters.push(
        hasTerrace ? PinBadge.R2_TO_2_5_TERRACE : PinBadge.R2_TO_2_5,
      );
    }
    if (rooms.includes(3)) {
      badgeFilters.push(hasTerrace ? PinBadge.R3_TERRACE : PinBadge.R3);
    }
    if (rooms.includes(4)) {
      badgeFilters.push(hasTerrace ? PinBadge.R4_TERRACE : PinBadge.R4);
    }

    // 복층 필터
    if (hasLoft) {
      badgeFilters.push(hasTerrace ? PinBadge.LOFT_TERRACE : PinBadge.LOFT);
    }

    const uniqueBadges = Array.from(new Set(badgeFilters));

    if (uniqueBadges.length > 0) {
      qb.andWhere('p.badge IN (:...badges)', {
        badges: uniqueBadges,
      });
    }

    // 1) 엘리베이터 (핀 기준)
    if (typeof dto.hasElevator === 'boolean') {
      qb.andWhere('p.has_elevator = :hasElevator', {
        hasElevator: dto.hasElevator ? 1 : 0,
      });
    }

    // 2) 매매가 (유닛 기준) – 기존 유지
    if (dto.salePriceMin != null) {
      qb.andWhere('u.min_price >= :priceMin', {
        priceMin: dto.salePriceMin,
      });
    }
    if (dto.salePriceMax != null) {
      qb.andWhere('u.max_price <= :priceMax', {
        priceMax: dto.salePriceMax,
      });
    }

    // 3) 등기 타입 (핀 기준)
    if (dto.buildingTypes?.length) {
      qb.andWhere('p.building_type IN (:...buildingTypes)', {
        buildingTypes: dto.buildingTypes,
      });
    }

    // 4) 전용면적 (areaGroups 기준) – 기존 로직 유지
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

    // 5) 실입주금 (핀 기준)
    if (dto.minRealMoveInCostMax != null) {
      qb.andWhere(
        'p.min_real_move_in_cost IS NOT NULL AND p.min_real_move_in_cost <= :moveInMax',
        { moveInMax: dto.minRealMoveInCostMax },
      );
    }

    // 6) 필터된 핀 id 목록 조회
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
        badge: (r.badge as PinBadge | null) ?? null,
        addressLine: r.addressLine,
      }));
    }

    // 7) 필터 사용 여부 (임시핀 숨길지 결정)
    const hasAnyFilter =
      uniqueBadges.length > 0 ||
      typeof dto.hasElevator === 'boolean' ||
      dto.salePriceMin != null ||
      dto.salePriceMax != null ||
      dto.areaMinM2 != null ||
      dto.areaMaxM2 != null ||
      (dto.buildingTypes?.length ?? 0) > 0 ||
      dto.minRealMoveInCostMax != null;

    // 8) 임시핀 검색 (필터가 하나도 없을 때만)
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
            .select([
              'r.pin_draft_id AS pinDraftId',
              'r.assignee_id AS assigneeId',
            ])
            .where('r.pin_draft_id IN (:...ids)', { ids: draftIds })
            .andWhere('r.is_deleted = :isDeleted', { isDeleted: 0 })
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

  async deletePin(id: number) {
    return this.dataSource.transaction(async (m) => {
      const pinRepo = m.getRepository(Pin);

      const pin = await pinRepo.findOne({ where: { id: String(id) } });
      if (!pin) {
        throw new NotFoundException('핀을 찾을 수 없습니다.');
      }

      await pinRepo.delete(String(id));

      return {
        id: String(id),
        deleted: true,
      };
    });
  }
}
