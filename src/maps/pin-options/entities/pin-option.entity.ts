import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Pin } from '../../pins/entities/pin.entity';

export enum KitchenLayout {
  G = 'G', // ㄱ
  D = 'D', // ㄷ
  LINE = 'LINE', // 일자
}

export enum LivingRoomView {
  OPEN = 'OPEN', // 뻥뷰
  NORMAL = 'NORMAL', // 평범
  BLOCKED = 'BLOCKED', // 막힘
}

export enum FridgeSlot {
  SLOT_1 = '1',
  SLOT_2 = '2',
  SLOT_3 = '3',
}

export enum SofaSize {
  SEAT_2 = 'SEAT_2',
  SEAT_3 = 'SEAT_3',
  SEAT_4 = 'SEAT_4',
}

@Entity({ name: 'pin_options' })
@Unique('uq_pin_options_pin', ['pinId'])
export class PinOption {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ type: 'bigint', unsigned: true, name: 'pin_id' })
  pinId!: string;

  @OneToOne(() => Pin, (pin) => pin.options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pin_id', referencedColumnName: 'id' })
  pin!: Pin;

  @Column({ type: 'boolean', name: 'has_aircon', default: false })
  hasAircon!: boolean;

  @Column({ type: 'boolean', name: 'has_fridge', default: false })
  hasFridge!: boolean;

  @Column({ type: 'boolean', name: 'has_washer', default: false })
  hasWasher!: boolean;

  @Column({ type: 'boolean', name: 'has_dryer', default: false })
  hasDryer!: boolean;

  @Column({ type: 'boolean', name: 'has_bidet', default: false })
  hasBidet!: boolean;

  @Column({ type: 'boolean', name: 'has_air_purifier', default: false })
  hasAirPurifier!: boolean;

  @Column({ type: 'boolean', name: 'is_direct_lease', default: false })
  isDirectLease!: boolean;

  @Column({
    type: 'enum',
    enum: KitchenLayout,
    name: 'kitchen_layout',
    nullable: true,
  })
  kitchenLayout!: KitchenLayout | null;

  // 냉장고자리: null 허용 enum (1/2/3)
  @Column({
    type: 'enum',
    enum: FridgeSlot,
    name: 'fridge_slot',
    nullable: true,
  })
  fridgeSlot!: FridgeSlot | null;

  // 쇼파자리: null 허용 enum (2/3/4)
  @Column({
    type: 'enum',
    enum: SofaSize,
    name: 'sofa_size',
    nullable: true,
  })
  sofaSize!: SofaSize | null;

  // 거실기준 뷰: null 허용 enum
  @Column({
    type: 'enum',
    enum: LivingRoomView,
    name: 'living_room_view',
    nullable: true,
  })
  livingRoomView!: LivingRoomView | null;

  // 아일랜드/주방창/도시가스/인덕션: bool
  @Column({ type: 'boolean', name: 'has_island_table', default: false })
  hasIslandTable!: boolean;

  @Column({ type: 'boolean', name: 'has_kitchen_window', default: false })
  hasKitchenWindow!: boolean;

  @Column({ type: 'boolean', name: 'has_city_gas', default: false })
  hasCityGas!: boolean;

  @Column({ type: 'boolean', name: 'has_induction', default: false })
  hasInduction!: boolean;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'extra_options_text',
    nullable: true,
  })
  extraOptionsText!: string | null;
}
