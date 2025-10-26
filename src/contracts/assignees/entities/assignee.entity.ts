// src/contracts/assignees/entities/assignee.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  RelationId,
} from 'typeorm';
import { Type } from 'class-transformer';
import { Contract } from '../../entities/contract.entity';
import { Account } from '../../../dashboard/accounts/entities/account.entity';

export type ContractAssigneeRole = 'company' | 'staff';

@Entity({ name: 'contract_assignees' })
export class ContractAssignee {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  @Type(() => Number)
  id!: number;

  /**
   * FK: contracts.id
   * 계약 삭제 시 담당자도 함께 삭제됨 (CASCADE)
   */
  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract!: Contract;

  @RelationId((a: ContractAssignee) => a.contract)
  @Type(() => Number)
  contractId!: number;

  @ManyToOne(() => Account, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'account_id' })
  account!: Account | null;

  @RelationId((a: ContractAssignee) => a.account)
  @Type(() => Number)
  accountId!: number | null;

  @Column({ type: 'enum', enum: ['company', 'staff'], default: 'staff' })
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
