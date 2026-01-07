import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Pin } from '../../../maps/pins/entities/pin.entity';

@Entity({ name: 'pin_photo_groups' })
export class PinPhotoGroup {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  /** FK만 단방향으로 가고 Pin 엔티티는 수정하지 않음 */
  @Index('idx_pin_photo_groups_pin_id')
  @Column({ type: 'bigint', unsigned: true, name: 'pin_id' })
  pinId!: string;

  @ManyToOne(() => Pin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pin_id' })
  pin!: Pin;

  @Column({ type: 'varchar', length: 100 })
  title!: string;

  @Column({ type: 'boolean', name: 'is_document', default: false })
  isDocument!: boolean;

  @Column({ type: 'smallint', unsigned: true, default: 0, name: 'sort_order' })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
