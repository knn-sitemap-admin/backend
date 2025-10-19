import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Pin } from '../../pins/entities/pin.entity';

@Entity({ name: 'units' })
@Index(['pinId'])
export class Unit {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  /* 소속 핀 */
  @Column({ type: 'bigint', unsigned: true, name: 'pin_id' })
  pinId!: string;

  @ManyToOne(() => Pin, (p) => p.units, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pin_id' })
  pin!: Pin;

  /* 구조 */
  @Column({ type: 'int', name: 'rooms', nullable: true })
  rooms: number | null = null;

  @Column({ type: 'int', name: 'baths', nullable: true })
  baths: number | null = null;

  @Column({ type: 'boolean', name: 'has_loft', nullable: true })
  hasLoft: boolean | null = null;

  @Column({ type: 'boolean', name: 'has_terrace', nullable: true })
  hasTerrace: boolean | null = null;

  @Column({ type: 'bigint', name: 'min_price', nullable: true })
  minPrice: number | null = null;

  @Column({ type: 'bigint', name: 'max_price', nullable: true })
  maxPrice: number | null = null;

  @Column({ type: 'varchar', length: 255, name: 'note', nullable: true })
  note: string | null = null;
}
