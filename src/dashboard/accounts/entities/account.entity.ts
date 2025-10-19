import {
  Column,
  Entity,
  OneToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AccountCredential } from './account-credential.entity';

export enum PositionRank {
  STAFF = 'STAFF', // 사원
  ASSISTANT_MANAGER = 'ASSISTANT_MANAGER', // 대리
  MANAGER = 'MANAGER', // 과장
  DEPUTY_GENERAL = 'DEPUTY_GENERAL', // 차장
  GENERAL_MANAGER = 'GENERAL_MANAGER', // 부장
  DIRECTOR = 'DIRECTOR', // 실장
}

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ type: 'bigint', unsigned: true, unique: true })
  credential_id!: string;

  @OneToOne(() => AccountCredential)
  @JoinColumn({ name: 'credential_id' })
  credential!: AccountCredential;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  emergency_contact!: string | null;

  @Column({ type: 'text', nullable: true })
  address_line!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  salary_bank_name!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, unique: true })
  salary_account!: string | null;

  @Column({ type: 'text', nullable: true })
  profile_url!: string | null;

  @Column({
    type: 'enum',
    enum: PositionRank,
    default: PositionRank.STAFF,
  })
  position_rank!: PositionRank;

  @Column({ type: 'boolean', default: false })
  is_profile_completed!: boolean;

  @Column({ type: 'text', nullable: true })
  doc_url_resident_registration!: string | null; // 등본

  @Column({ type: 'text', nullable: true })
  doc_url_resident_abstract!: string | null; // 초본

  @Column({ type: 'text', nullable: true })
  doc_url_id_card!: string | null; // 신분증

  @Column({ type: 'text', nullable: true })
  doc_url_family_relation!: string | null; // 가족관계증명서

  @Column({ type: 'boolean', default: false })
  is_deleted!: boolean;

  @Column({ type: 'datetime', nullable: true })
  deleted_at!: Date | null;
}
