import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Type } from 'class-transformer';
import { Account } from '../../dashboard/accounts/entities/account.entity';

export type SettlementStatus = 'pending' | 'paid';

@Entity({ name: 'settlements' })
@Index('IDX_settlements_year_month', ['year', 'month'])
@Index('IDX_settlements_account_id', ['accountId'])
export class Settlement {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  @Type(() => Number)
  id!: number;

  @Column({ type: 'bigint', unsigned: true, name: 'account_id' })
  accountId!: string;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Account;

  @Column({ type: 'int' })
  year!: number;

  @Column({ type: 'int' })
  month!: number;

  @Column({ type: 'bigint', unsigned: true, default: 0 })
  @Type(() => Number)
  calculatedAmount!: number; // 실적 기반 계산된 금액

  @Column({ type: 'bigint', default: 0 })
  @Type(() => Number)
  adjustmentAmount!: number; // 수동 조정 금액 (+ 또는 -)

  @Column({ type: 'bigint', unsigned: true, default: 0 })
  @Type(() => Number)
  finalAmount!: number; // 최종 지급액

  @Column({
    type: 'enum',
    enum: ['pending', 'paid'],
    default: 'pending',
  })
  status!: SettlementStatus;

  @Column({ type: 'timestamp', nullable: true, name: 'paid_at' })
  paidAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  memo!: string | null;

  @Column({ type: 'bigint', unsigned: true, nullable: true, name: 'ledger_id' })
  @Type(() => Number)
  ledgerId!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
