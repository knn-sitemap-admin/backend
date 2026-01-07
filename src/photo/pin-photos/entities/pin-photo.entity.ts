import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { PinPhotoGroup } from '../../pin-photo-groups/entities/pin-photo-group.entity';

@Entity({ name: 'pin_photos' })
export class PinPhoto {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ type: 'text' })
  url!: string;

  @Column({ type: 'boolean', name: 'is_cover', default: false })
  isCover!: boolean;

  @Column({ type: 'smallint', unsigned: true, default: 0, name: 'sort_order' })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Index('idx_pin_photos_group_id')
  @Column({ type: 'bigint', unsigned: true, name: 'group_id' })
  groupId!: string;

  @ManyToOne(() => PinPhotoGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: PinPhotoGroup;
}
