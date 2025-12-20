import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  RelationId,
  CreateDateColumn,
} from 'typeorm';
import { Type } from 'class-transformer';
import { Contract } from '../../entities/contract.entity';
import { Account } from '../../../dashboard/accounts/entities/account.entity';

@Entity({ name: 'contract_assignees' })
@Index('IDX_contract_assignees_contract', ['contract'])
@Index('IDX_contract_assignees_account', ['account'])
export class ContractAssignee {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  @Type(() => Number)
  id!: number;

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
  accountId!: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  @Type(() => Number)
  sharePercent!: number; // 직원들 합 100

  @Column({ type: 'smallint', unsigned: true, default: 0 })
  @Type(() => Number)
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
