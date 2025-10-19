import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Account } from '../../../dashboard/accounts/entities/account.entity';
import { FavoriteGroupItem } from '../../item/entities/item.entity';

@Entity('favorite_groups')
@Index(['ownerAccountId'])
@Index(['ownerAccountId', 'title'], { unique: true })
export class FavoriteGroup {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ type: 'bigint', unsigned: true, name: 'owner_account_id' })
  ownerAccountId!: string;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_account_id', referencedColumnName: 'id' })
  owner!: Account;

  @Column({ type: 'varchar', length: 32 })
  title!: string;

  @Column({ type: 'smallint', unsigned: true, name: 'sort_order', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => FavoriteGroupItem, (item) => item.group)
  items!: FavoriteGroupItem[];
}
