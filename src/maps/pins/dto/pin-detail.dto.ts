import { Pin } from '../entities/pin.entity';
import { PinAreaGroup } from '../../pin_area_groups/entities/pin_area_group.entity';
import { Unit } from '../../units/entities/unit.entity';
import { PinOption } from '../../pin-options/entities/pin-option.entity';
import { PinDirection } from '../../pin-directions/entities/pin-direction.entity';

function toIntOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : Math.trunc(n);
}

function toISODateOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}
function toNumOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
function toBoolOrNull(v: unknown): boolean | null {
  if (v == null) return null;
  if (typeof v === 'boolean') return v;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return n === 1;
}

export class PinDirectionResponseDto {
  direction!: string;
  static fromEntity(entity: PinDirection): PinDirectionResponseDto {
    return { direction: entity.direction };
  }
}

export class PinAreaGroupResponseDto {
  title!: string | null;
  exclusiveMinM2!: number | null;
  exclusiveMaxM2!: number | null;
  actualMinM2!: number | null;
  actualMaxM2!: number | null;
  sortOrder!: number;

  static fromEntity(entity: PinAreaGroup): PinAreaGroupResponseDto {
    return {
      title: entity.title ?? null,
      exclusiveMinM2: toNumOrNull(entity.exclusiveMinM2),
      exclusiveMaxM2: toNumOrNull(entity.exclusiveMaxM2),
      actualMinM2: toNumOrNull(entity.actualMinM2),
      actualMaxM2: toNumOrNull(entity.actualMaxM2),
      sortOrder: entity.sortOrder ?? 0,
    };
  }
}

export class UnitResponseDto {
  rooms!: number | null;
  baths!: number | null;
  hasLoft!: boolean | null;
  hasTerrace!: boolean | null;
  minPrice!: number | null;
  maxPrice!: number | null;
  note!: string | null;

  static fromEntity(entity: Unit): UnitResponseDto {
    return {
      rooms: toNumOrNull(entity.rooms),
      baths: toNumOrNull(entity.baths),
      hasLoft: toBoolOrNull(entity.hasLoft),
      hasTerrace: toBoolOrNull(entity.hasTerrace),
      minPrice: toNumOrNull(entity.minPrice ?? entity.minPrice),
      maxPrice: toNumOrNull(entity.maxPrice ?? entity.maxPrice),
      note: entity.note ?? null,
    };
  }
}

export class PinOptionsResponseDto {
  hasAircon!: boolean | null;
  hasFridge!: boolean | null;
  hasWasher!: boolean | null;
  hasDryer!: boolean | null;
  hasBidet!: boolean | null;
  hasAirPurifier!: boolean | null;
  isDirectLease!: boolean | null;
  extraOptionsText!: string | null;

  static fromEntity(entity: PinOption): PinOptionsResponseDto {
    return {
      hasAircon: toBoolOrNull(entity.hasAircon),
      hasFridge: toBoolOrNull(entity.hasFridge),
      hasWasher: toBoolOrNull(entity.hasWasher),
      hasDryer: toBoolOrNull(entity.hasDryer),
      hasBidet: toBoolOrNull(entity.hasBidet),
      hasAirPurifier: toBoolOrNull(entity.hasAirPurifier),
      isDirectLease: toBoolOrNull(entity.isDirectLease),
      extraOptionsText: entity.extraOptionsText ?? null,
    };
  }
}

// 관련 인물 DTO
export type PinPersonInfo = {
  id: string;
  name: string | null;
};

export type PinAgeType = 'OLD' | 'NEW' | null;

//최상위 DTO
export class PinResponseDto {
  id!: string;
  lat!: number;
  lng!: number;
  name!: string;
  badge!: string | null;
  addressLine!: string;
  rebateText!: string | null;

  totalBuildings!: number | null;
  totalFloors!: number | null;
  remainingHouseholds!: number | null;
  minRealMoveInCost!: number | null;

  completionDate!: string | null;
  buildingType!: string | null;
  totalHouseholds!: number | null;
  totalParkingSlots!: number | null;
  registrationTypeId!: number | null;
  parkingType!: string | null;
  parkingGrade!: string | null;
  slopeGrade!: string | null;
  structureGrade!: string | null;
  hasElevator!: boolean | null;

  // 구옥/신축 구분
  ageType!: PinAgeType;

  publicMemo!: string | null;
  privateMemo!: string | null;

  contactMainLabel!: string | null;
  contactMainPhone!: string;
  contactSubLabel!: string | null;
  contactSubPhone!: string | null;

  // 생성/수정/답사 시각
  createdAt!: string | null;
  updatedAt!: string | null;
  surveyedAt!: string | null;

  // 관련 인물 id
  creatorId!: string | null;
  surveyorId!: string | null;
  lastEditorId!: string | null;

  // 관련 인물 정보
  creator!: PinPersonInfo | null;
  surveyor!: PinPersonInfo | null;
  lastEditor!: PinPersonInfo | null;

  directions!: PinDirectionResponseDto[];
  areaGroups!: PinAreaGroupResponseDto[];
  units!: UnitResponseDto[];
  options!: PinOptionsResponseDto | null;

  static fromEntity(
    entity: Pin,
    people?: {
      creator?: PinPersonInfo | null;
      surveyor?: PinPersonInfo | null;
      lastEditor?: PinPersonInfo | null;
    },
  ): PinResponseDto {
    const isOldFlag = !!entity.isOld;
    const isNewFlag = !!entity.isNew;

    let ageType: PinAgeType = null;

    // 정책: 둘 다 true면 NEW 우선 (필요하면 OLD 우선으로 바꿔도 됨)
    if (isNewFlag && !isOldFlag) {
      ageType = 'NEW';
    } else if (isOldFlag && !isNewFlag) {
      ageType = 'OLD';
    } else if (isNewFlag && isOldFlag) {
      ageType = 'NEW';
    }

    return {
      id: String(entity.id),
      lat: Number(entity.lat),
      lng: Number(entity.lng),
      name: entity.name,
      badge: entity.badge ?? null,
      addressLine: entity.addressLine,
      rebateText: entity.rebateText ?? null,

      completionDate: toISODateOrNull(entity.completionDate),
      buildingType: entity.buildingType ?? null,
      totalHouseholds: toNumOrNull(entity.totalHouseholds),
      totalParkingSlots: toNumOrNull(entity.totalParkingSlots),
      registrationTypeId: toNumOrNull(entity.registrationTypeId),
      parkingType: entity.parkingType,
      parkingGrade: entity.parkingGrade ?? null,
      slopeGrade: entity.slopeGrade ?? null,
      structureGrade: entity.structureGrade ?? null,
      hasElevator: toBoolOrNull(entity.hasElevator),

      ageType,

      publicMemo: entity.publicMemo ?? null,
      privateMemo: entity.privateMemo ?? null,

      contactMainLabel: entity.contactMainLabel ?? null,
      contactMainPhone: entity.contactMainPhone,
      contactSubLabel: entity.contactSubLabel ?? null,
      contactSubPhone: entity.contactSubPhone ?? null,

      totalBuildings: toNumOrNull(entity.totalBuildings),
      totalFloors: toNumOrNull(entity.totalFloors),
      remainingHouseholds: toNumOrNull(entity.remainingHouseholds),
      minRealMoveInCost: toIntOrNull(entity.minRealMoveInCost),

      createdAt: toISODateOrNull((entity as any).createdAt),
      updatedAt: toISODateOrNull((entity as any).updatedAt),
      surveyedAt: toISODateOrNull((entity as any).surveyedAt),

      // id만
      creatorId: entity.creatorId ? String(entity.creatorId) : null,
      surveyorId: entity.surveyedBy ? String(entity.surveyedBy) : null,
      lastEditorId:
        (entity as any).lastEditorId != null
          ? String((entity as any).lastEditorId)
          : null,

      // 이름 포함 객체
      creator: people?.creator ?? null,
      surveyor: people?.surveyor ?? null,
      lastEditor: people?.lastEditor ?? null,

      directions:
        entity.directions?.map(PinDirectionResponseDto.fromEntity) ?? [],
      areaGroups: (entity.areaGroups ?? [])
        .slice()
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map(PinAreaGroupResponseDto.fromEntity),
      units: entity.units?.map(UnitResponseDto.fromEntity) ?? [],
      options: entity.options
        ? PinOptionsResponseDto.fromEntity(entity.options)
        : null,
    };
  }
}
