import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Notice } from './notice.entity';
import { Account } from '../../dashboard/accounts/entities/account.entity';

@Entity('notice_reads')
@Unique(['notice', 'account'])
export class NoticeRead {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: number;

  @ManyToOne(() => Notice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notice_id' })
  notice!: Notice;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Account;

  @CreateDateColumn({ name: 'read_at' })
  readAt!: Date;
}
