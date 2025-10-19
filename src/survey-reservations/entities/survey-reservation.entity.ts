import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { PinDraft } from './pin-draft.entity';
import { Account } from '../../dashboard/accounts/entities/account.entity';

@Entity({ name: 'survey_reservations' })
export class SurveyReservation {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  // 예약 대상 임시핀
  @Index()
  @ManyToOne(() => PinDraft, { nullable: false })
  @JoinColumn({ name: 'pin_draft_id' })
  pinDraft!: PinDraft;

  // 담당자(예약 등록자)
  @Index()
  @ManyToOne(() => Account, { nullable: false })
  @JoinColumn({ name: 'assignee_id' })
  assignee!: Account;

  // 답사 예정일
  @Index()
  @Column({ type: 'date', name: 'reserved_date' })
  reservedDate!: string;

  // 생성 시각
  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted!: boolean;

  @Column({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt: Date | null = null;
}
