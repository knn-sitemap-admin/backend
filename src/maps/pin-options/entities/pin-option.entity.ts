import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Pin } from '../../pins/entities/pin.entity';

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
    type: 'varchar',
    length: 255,
    name: 'extra_options_text',
    nullable: true,
  })
  extraOptionsText!: string | null;
}
