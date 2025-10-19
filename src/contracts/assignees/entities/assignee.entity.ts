import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Type } from 'class-transformer';
import { Contract } from '../../entities/contract.entity';

export type ContractAssigneeRole = 'company' | 'staff';

@Entity({ name: 'contract_assignees' })
export class ContractAssignee {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  @Type(() => Number)
  id!: number;

  @Index()
  @Column('bigint', { unsigned: true })
  @Type(() => Number)
  contractId!: number;

  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract!: Contract;

  @Index()
  @Column('bigint', { unsigned: true, nullable: true })
  @Type(() => Number)
  accountId!: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  assigneeName!: string | null;

  @Column({
    type: 'enum',
    enum: ['company', 'staff'],
    default: 'staff',
  })
  role!: ContractAssigneeRole;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  @Type(() => Number)
  sharePercent!: number;

  @Column({ type: 'bigint', default: 0 })
  @Type(() => Number)
  rebateAmount!: number;

  @Column({ type: 'bigint', default: 0 })
  @Type(() => Number)
  finalAmount!: number;

  @Column({ type: 'boolean', default: false })
  isManual!: boolean;

  @Column({ type: 'smallint', unsigned: true, default: 0 })
  @Type(() => Number)
  sortOrder!: number;
}
