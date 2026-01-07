import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Pin } from '../../pins/entities/pin.entity';

@Entity('pin_area_groups')
export class PinAreaGroup {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true }) id!: string;
  @Column({ type: 'bigint', unsigned: true, name: 'pin_id' }) pinId!: string;

  @ManyToOne(() => Pin, (p) => p.areaGroups, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pin_id' })
  pin!: Pin;

  @Column({ type: 'varchar', length: 100, nullable: true }) title:
    | string
    | null = null;
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  exclusiveMinM2: string | null;
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  exclusiveMaxM2: string | null;
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  actualMinM2: string | null;
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  actualMaxM2: string | null;
  @Column({ type: 'smallint', unsigned: true, default: 0 }) sortOrder!: number;
}
