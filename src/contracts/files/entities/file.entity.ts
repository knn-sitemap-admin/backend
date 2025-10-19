import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { Type } from 'class-transformer';
import { Contract } from '../../entities/contract.entity';

@Entity({ name: 'contract_files' })
export class ContractFile {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  @Type(() => Number)
  id!: number;

  @Index()
  @Column('bigint', { unsigned: true })
  @Type(() => Number)
  contractId!: number;

  @ManyToOne(() => Contract, (c) => c, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract!: Contract;

  @Column('text')
  url!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  filename!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
