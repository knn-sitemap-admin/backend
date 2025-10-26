import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Type } from 'class-transformer';
import { Account } from '../../dashboard/accounts/entities/account.entity';

@Entity({ name: 'contracts' })
@Index('IDX_contracts_contract_date', ['contractDate'])
@Index('IDX_contracts_status', ['status'])
@Index('IDX_contracts_salesperson_id', ['salesperson'])
export class Contract {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  @Type(() => Number)
  id!: number;

  @Index()
  @Column('bigint', { unsigned: true, nullable: true })
  @Type(() => Number)
  pinId!: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  customerName!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  customerPhone!: string | null;

  @ManyToOne(() => Account, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'salesperson_id' })
  salesperson?: Account | null;

  // 금액/계산 관련 (프론트 계산값 그대로 저장)
  @Column({ type: 'bigint', default: 0 })
  @Type(() => Number)
  brokerageFee!: number;

  @Column({ type: 'bigint', default: 0 })
  @Type(() => Number)
  vat!: number;

  @Column({ type: 'bigint', default: 0 })
  @Type(() => Number)
  brokerageTotal!: number;

  @Column({ type: 'bigint', default: 0 })
  @Type(() => Number)
  rebateTotal!: number;

  @Column({ type: 'bigint', default: 0 })
  @Type(() => Number)
  supportAmount!: number;

  @Column({ type: 'boolean', default: true })
  isTaxed!: boolean;

  @Column({ type: 'text', nullable: true })
  calcMemo!: string | null;

  @Column({ type: 'bigint', default: 0 })
  @Type(() => Number)
  grandTotal!: number;

  @Index()
  @Column({ type: 'date', name: 'contract_date' })
  contractDate!: string; // 'YYYY-MM-DD'

  @Index()
  @Column({
    type: 'enum',
    enum: ['ongoing', 'done', 'canceled'],
    default: 'ongoing',
  })
  status!: 'ongoing' | 'done' | 'canceled';

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
