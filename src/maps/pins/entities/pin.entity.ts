import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Index,
  OneToOne,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';
import { PinDirection } from '../../pin-directions/entities/pin-direction.entity';
import { Unit } from '../../units/entities/unit.entity';
import { PinOption } from '../../pin-options/entities/pin-option.entity';
import { PinAreaGroup } from '../../pin_area_groups/entities/pin_area_group.entity';

export type Grade3 = '상' | '중' | '하';
export type BuildingType = 'APT' | 'OP' | '주택' | '근생' | '도생';

export enum PinBadge {
  R1_TO_1_5 = 'R1_TO_1_5',
  R1_TO_1_5_TERRACE = 'R1_TO_1_5_TERRACE',
  R2_TO_2_5 = 'R2_TO_2_5',
  R2_TO_2_5_TERRACE = 'R2_TO_2_5_TERRACE',
  R3 = 'R3',
  R3_TERRACE = 'R3_TERRACE',
  R4 = 'R4',
  R4_TERRACE = 'R4_TERRACE',
  LOFT = 'LOFT', // 복층
  LOFT_TERRACE = 'LOFT_TERRACE', // 복층테라스
  TOWNHOUSE = 'TOWNHOUSE', // 타운하우스
}

@Entity({ name: 'pins' })
@Index(['lat', 'lng'])
export class Pin {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ type: 'decimal', precision: 12, scale: 9, name: 'lat' })
  lat!: string;

  @Column({ type: 'decimal', precision: 13, scale: 9, name: 'lng' })
  lng!: string;

  @Column({ type: 'varchar', length: 255, name: 'name' })
  name!: string;

  @Column({
    type: 'enum',
    enum: PinBadge,
    name: 'badge',
    nullable: true,
  })
  badge: PinBadge | null = null;

  @Column({ type: 'text', name: 'address_line' })
  addressLine!: string;

  @Column({ type: 'date', name: 'completion_date', nullable: true })
  completionDate: Date | null = null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'rebate_text',
    nullable: true,
  })
  rebateText: string | null = null;

  @Column({
    type: 'enum',
    enum: ['APT', 'OP', '주택', '근생', '도생'],
    name: 'building_type',
    nullable: true,
  })
  buildingType: BuildingType | null = null;

  @Column({ type: 'boolean', name: 'has_elevator', nullable: true })
  hasElevator: boolean | null = null;

  @Column({ type: 'int', name: 'total_households', nullable: true })
  totalHouseholds: number | null = null;

  @Column({ type: 'int', name: 'total_parking_slots', nullable: true })
  totalParkingSlots: number | null = null;

  @Column({
    type: 'int',
    unsigned: true,
    name: 'registration_type_id',
    nullable: true,
  })
  registrationTypeId: number | null = null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'parking_type',
    nullable: true,
  })
  parkingType: string | null = null;

  @Column({
    type: 'varchar',
    length: 10,
    name: 'parking_grade',
    nullable: true,
  })
  parkingGrade: string | null = null;

  @Column({
    type: 'enum',
    enum: ['상', '중', '하'],
    name: 'slope_grade',
    nullable: true,
  })
  slopeGrade: Grade3 | null = null;

  @Column({
    type: 'enum',
    enum: ['상', '중', '하'],
    name: 'structure_grade',
    nullable: true,
  })
  structureGrade: Grade3 | null = null;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'contact_main_label',
    nullable: true,
  })
  contactMainLabel: string;

  @Column({ type: 'varchar', length: 50, name: 'contact_main_phone' })
  contactMainPhone!: string;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'contact_sub_label',
    nullable: true,
  })
  contactSubLabel: string | null = null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'contact_sub_phone',
    nullable: true,
  })
  contactSubPhone: string | null = null;

  @Column({ type: 'boolean', default: false })
  isOld!: boolean;

  @Column({ type: 'boolean', default: false })
  isNew!: boolean;

  @Column({ type: 'text', name: 'public_memo', nullable: true })
  publicMemo: string | null = null;

  @Column({ type: 'text', name: 'private_memo', nullable: true })
  privateMemo: string | null = null;

  @OneToOne(() => PinOption, (opt) => opt.pin)
  options!: PinOption | null;

  @Column({ type: 'boolean', name: 'is_disabled', default: false })
  isDisabled!: boolean;

  @Column({
    type: 'bigint',
    unsigned: true,
    name: 'surveyed_by',
    nullable: true,
  })
  surveyedBy: string | null = null;

  @Column({ type: 'datetime', name: 'surveyed_at', nullable: true })
  surveyedAt: Date | null = null;

  @Column({
    type: 'bigint',
    unsigned: true,
    name: 'creator_id',
    nullable: true,
  })
  creatorId: string | null = null;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted!: boolean;

  @Column({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt: Date | null = null;

  @OneToMany(() => PinAreaGroup, (g) => g.pin, { cascade: ['remove'] })
  areaGroups!: PinAreaGroup[];

  @OneToMany(() => PinDirection, (d) => d.pin, { cascade: ['remove'] })
  directions!: PinDirection[];

  @OneToMany(() => Unit, (u) => u.pin, { cascade: ['remove'] })
  units!: Unit[];

  @Column({ type: 'int', name: 'total_buildings', nullable: true })
  totalBuildings: number | null = null;

  @Column({ type: 'int', name: 'total_floors', nullable: true })
  totalFloors: number | null = null;

  @Column({ type: 'int', name: 'remaining_households', nullable: true })
  remainingHouseholds: number | null = null;

  @Column({
    type: 'bigint',
    name: 'min_real_move_in_cost',
    nullable: true,
    unsigned: true,
  })
  minRealMoveInCost: string | null = null;

  @Column({
    type: 'bigint',
    unsigned: true,
    name: 'last_editor_id',
    nullable: true,
  })
  lastEditorId: string | null = null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;
}
