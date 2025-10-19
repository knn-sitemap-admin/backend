import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Pin } from '../../pins/entities/pin.entity';

@Entity({ name: 'pin_directions' })
@Index(['pinId'])
export class PinDirection {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ type: 'bigint', unsigned: true, name: 'pin_id' })
  pinId!: string;

  @ManyToOne(() => Pin, (p) => p.directions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pin_id' })
  pin!: Pin;

  /** 방향 텍스트: '남', '북', '동', '서', '남서' 등 */
  @Column({ type: 'varchar', length: 10 })
  direction!: string;
}
