import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { FavoriteGroup } from '../../group/entities/group.entity';
import { Pin } from '../../../maps/pins/entities/pin.entity';

@Entity('favorite_group_items')
@Index(['groupId']) // 그룹 기준 조회
@Index(['pinId']) // 핀 기준 역탐색
@Index(['groupId', 'pinId'], { unique: true }) // 그룹 내 동일 핀 중복 방지
export class FavoriteGroupItem {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ type: 'bigint', unsigned: true, name: 'group_id' })
  groupId!: string;

  @ManyToOne(() => FavoriteGroup, (g) => g.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id', referencedColumnName: 'id' })
  group!: FavoriteGroup;

  @Column({ type: 'bigint', unsigned: true, name: 'pin_id' })
  pinId!: string;

  @ManyToOne(() => Pin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pin_id', referencedColumnName: 'id' })
  pin!: Pin;

  @Column({ type: 'smallint', unsigned: true, name: 'sort_order' })
  sortOrder!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;
}
