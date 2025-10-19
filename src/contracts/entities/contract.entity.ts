import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Type } from 'class-transformer';
@Entity({ name: 'contracts' })
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

  @Column({ type: 'varchar', length: 100, nullable: true })
  distributorName!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  distributorPhone!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  salespersonName!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  salespersonPhone!: string | null;

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

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
