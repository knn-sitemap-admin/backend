import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Account } from '../../dashboard/accounts/entities/account.entity';

@Entity('schedules')
export class Schedule {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  content!: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true })
  category!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  customer_phone_last_4!: string | null;

  @Column({ type: 'datetime' })
  start_date!: Date;

  @Column({ type: 'datetime' })
  end_date!: Date;

  @Column({ type: 'boolean', default: false })
  is_all_day!: boolean;

  @Column({ type: 'varchar', length: 20, default: 'blue' })
  color!: string;

  @Column({ type: 'bigint', unsigned: true })
  created_by_account_id!: string;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'created_by_account_id' })
  createdByAccount!: Account;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;

  @Column({ type: 'boolean', default: false })
  is_deleted!: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true, default: '신규' })
  meeting_type!: string | null;

  @Column({ type: 'datetime', nullable: true })
  deleted_at!: Date | null;
}
