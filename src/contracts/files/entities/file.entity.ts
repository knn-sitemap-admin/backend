import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  Index,
  RelationId,
} from 'typeorm';
import { Type } from 'class-transformer';
import { Contract } from '../../entities/contract.entity';

@Entity({ name: 'contract_files' })
export class ContractFile {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  @Type(() => Number)
  id!: number;

  @Index('IDX_contract_files_contract_id')
  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract!: Contract;

  @RelationId((f: ContractFile) => f.contract)
  @Type(() => Number)
  contractId!: number;

  @Column('text')
  url!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  filename!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
