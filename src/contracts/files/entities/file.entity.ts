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

@Entity({ name: 'contract_files' })
@Index('IDX_contract_files_contract', ['contract'])
export class ContractFile {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  @Type(() => Number)
  id!: number;

  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract!: Contract;

  @RelationId((f: ContractFile) => f.contract)
  @Type(() => Number)
  contractId!: number;

  @Column({ type: 'text' })
  url!: string;

  @Column({ type: 'smallint', unsigned: true, default: 0 })
  @Type(() => Number)
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
