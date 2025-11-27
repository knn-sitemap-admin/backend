import { PinDraft } from '../entities/pin-draft.entity';

export class PinDraftDetailDto {
  id!: string;
  lat!: number;
  lng!: number;
  addressLine!: string;
  name: string | null;
  contactMainPhone: string | null;
  createdAt!: Date;

  static fromEntity(d: PinDraft): PinDraftDetailDto {
    const dto = new PinDraftDetailDto();
    dto.id = String(d.id);
    dto.lat = Number(d.lat);
    dto.lng = Number(d.lng);
    dto.addressLine = d.addressLine;
    dto.name = d.name ?? null;
    dto.contactMainPhone = d.contactMainPhone ?? null;
    dto.createdAt = d.createdAt;
    return dto;
  }
}
