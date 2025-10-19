import { Pin } from '../entities/pin.entity';
import { PinAreaGroup } from '../../pin_area_groups/entities/pin_area_group.entity';
import { Unit } from '../../units/entities/unit.entity';
import { PinOption } from '../../pin-options/entities/pin-option.entity';
import { PinDirection } from '../../pin-directions/entities/pin-direction.entity';

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
      title: entity.title,
      exclusiveMinM2: entity.exclusiveMinM2
        ? Number(entity.exclusiveMinM2)
        : null,
      exclusiveMaxM2: entity.exclusiveMaxM2
        ? Number(entity.exclusiveMaxM2)
        : null,
      actualMinM2: entity.actualMinM2 ? Number(entity.actualMinM2) : null,
      actualMaxM2: entity.actualMaxM2 ? Number(entity.actualMaxM2) : null,
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
      rooms: entity.rooms,
      baths: entity.baths,
      hasLoft: entity.hasLoft,
      hasTerrace: entity.hasTerrace,
      minPrice: entity.minPrice,
      maxPrice: entity.maxPrice,
      note: entity.note,
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
      hasAircon: entity.hasAircon,
      hasFridge: entity.hasFridge,
      hasWasher: entity.hasWasher,
      hasDryer: entity.hasDryer,
      hasBidet: entity.hasBidet,
      hasAirPurifier: entity.hasAirPurifier,
      isDirectLease: entity.isDirectLease,
      extraOptionsText: entity.extraOptionsText,
    };
  }
}

// 최상위 DTO
export class PinResponseDto {
  id!: string;
  lat!: number;
  lng!: number;
  name!: string;
  badge!: string | null;
  addressLine!: string;

  // 건물/기타 속성
  completionDate!: string | null;
  buildingType!: string | null;
  totalHouseholds!: number | null;
  totalParkingSlots!: number | null;
  registrationTypeId!: number | null;
  parkingTypeId!: number | null;
  parkingGrade!: string | null;
  slopeGrade!: string | null;
  structureGrade!: string | null;
  hasElevator!: boolean | null;
  isOld!: boolean;
  isNew!: boolean;
  publicMemo!: string | null;
  privateMemo!: string | null;

  // 연락처
  contactMainLabel!: string;
  contactMainPhone!: string;
  contactSubLabel!: string | null;
  contactSubPhone!: string | null;

  // 연관 관계
  directions!: PinDirectionResponseDto[];
  areaGroups!: PinAreaGroupResponseDto[];
  units!: UnitResponseDto[];
  options!: PinOptionsResponseDto | null;

  static fromEntity(entity: Pin): PinResponseDto {
    return {
      id: String(entity.id),
      lat: Number(entity.lat),
      lng: Number(entity.lng),
      name: entity.name,
      badge: entity.badge ?? null,
      addressLine: entity.addressLine,

      completionDate: entity.completionDate
        ? entity.completionDate.toISOString().split('T')[0]
        : null,
      buildingType: entity.buildingType ?? null,
      totalHouseholds: entity.totalHouseholds,
      totalParkingSlots: entity.totalParkingSlots,
      registrationTypeId: entity.registrationTypeId,
      parkingTypeId: entity.parkingTypeId,
      parkingGrade: entity.parkingGrade,
      slopeGrade: entity.slopeGrade,
      structureGrade: entity.structureGrade,
      hasElevator: entity.hasElevator,
      isOld: entity.isOld,
      isNew: entity.isNew,
      publicMemo: entity.publicMemo,
      privateMemo: entity.privateMemo,

      contactMainLabel: entity.contactMainLabel,
      contactMainPhone: entity.contactMainPhone,
      contactSubLabel: entity.contactSubLabel,
      contactSubPhone: entity.contactSubPhone,

      directions:
        entity.directions?.map((d) => PinDirectionResponseDto.fromEntity(d)) ??
        [],
      areaGroups:
        entity.areaGroups
          ?.sort((a, b) => a.sortOrder - b.sortOrder)
          .map((g) => PinAreaGroupResponseDto.fromEntity(g)) ?? [],
      units: entity.units?.map((u) => UnitResponseDto.fromEntity(u)) ?? [],
      options: entity.options
        ? PinOptionsResponseDto.fromEntity(entity.options)
        : null,
    };
  }
}
