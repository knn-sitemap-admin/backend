import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  RelationId,
} from 'typeorm';
import { Type } from 'class-transformer';
import { Account } from '../../dashboard/accounts/entities/account.entity';

export type ContractStatus = 'ongoing' | 'done' | 'canceled' | 'rejected';

@Entity({ name: 'contracts' })
@Index('UQ_contracts_contract_no', ['contractNo'], { unique: true })
@Index('IDX_contracts_contract_date', ['contractDate'])
@Index('IDX_contracts_created_by', ['createdBy'])
@Index('IDX_contracts_status', ['status'])
export class Contract {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  @Type(() => Number)
  id!: number;

  @Column({ type: 'varchar', length: 40 })
  contractNo!: string;

  // 생성자(=담당자)
  @ManyToOne(() => Account, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_account_id' })
  createdBy!: Account | null;

  @RelationId((c: Contract) => c.createdBy)
  createdByAccountId!: string | null;

  // 고객
  @Column({ type: 'varchar', length: 100 })
  customerName!: string;

  @Column({ type: 'varchar', length: 30 })
  customerPhone!: string;

  // 원본 금액/옵션
  @Column({ type: 'bigint', unsigned: true })
  @Type(() => Number)
  brokerageFee!: number; // 원 단위

  @Column({ type: 'boolean', default: false })
  vatEnabled!: boolean; // 10%

  @Column({ type: 'int', unsigned: true })
  @Type(() => Number)
  rebateUnits!: number; // 1=100만원

  @Column({ type: 'bigint', unsigned: true, default: 0 })
  @Type(() => Number)
  supportAmount!: number; // 원 단위

  @Column({ type: 'boolean', default: true })
  isTaxed!: boolean; // 3.3% 적용 여부(0.967)

  @Column({ type: 'text', nullable: true })
  calcMemo!: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  @Type(() => Number)
  companyPercent!: number; // 0~100

  // 날짜/상태
  @Column({ type: 'date', name: 'contract_date' })
  contractDate!: string; // YYYY-MM-DD

  @Column({ type: 'date', name: 'final_payment_date' })
  finalPaymentDate!: string; // YYYY-MM-DD

  @Column({
    type: 'enum',
    enum: ['ongoing', 'done', 'canceled', 'rejected'],
    default: 'ongoing',
  })
  status!: ContractStatus;

  // 현장 정보
  @Column({ type: 'varchar', length: 255 })
  siteAddress!: string;

  @Column({ type: 'varchar', length: 100 })
  siteName!: string;

  @Column({ type: 'varchar', length: 30 })
  salesTeamPhone!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  bank!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  account!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
