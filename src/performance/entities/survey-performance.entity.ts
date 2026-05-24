import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Account } from '../../dashboard/accounts/entities/account.entity';
import { Pin } from '../../maps/pins/entities/pin.entity';

@Entity({ name: 'survey_performance' })
export class SurveyPerformance {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ type: 'bigint', unsigned: true, name: 'account_id' })
  @Index()
  accountId!: string;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Account;

  @Column({ type: 'bigint', unsigned: true, name: 'pin_id' })
  pinId!: string;

  @ManyToOne(() => Pin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pin_id' })
  pin!: Pin;

  @Column({ type: 'varchar', length: 255, name: 'pin_draft_id', nullable: true })
  pinDraftId: string | null = null;

  @Column({ type: 'datetime', name: 'surveyed_at' })
  @Index()
  surveyedAt!: Date;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;
}
