import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { Type } from 'class-transformer';
import { Account } from '../../dashboard/accounts/entities/account.entity';

@Entity({ name: 'ledgers' })
@Index('IDX_ledgers_entry_date', ['entryDate'])
@Index('IDX_ledgers_credential_id', ['credentialId'])
export class Ledger {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  @Type(() => Number)
  id!: number;

  // 기입날짜
  @Column({ type: 'date', name: 'entry_date' })
  entryDate!: string; // YYYY-MM-DD

  // 메인라벨 (항목/분류)
  @Column({ type: 'varchar', length: 100, name: 'main_label' })
  mainLabel!: string;

  // 금액 (지출/수입)
  @Column({ type: 'bigint' })
  @Type(() => Number)
  amount!: number;

  // 메모
  @Column({ type: 'text', nullable: true })
  memo!: string | null;

  // 작성자 계정 식별자 (credentialId 기준)
  @Column({ type: 'bigint', unsigned: true, name: 'credential_id' })
  credentialId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @BeforeInsert()
  setDefaultEntryDate() {
    if (!this.entryDate) {
      this.entryDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    }
  }
}
