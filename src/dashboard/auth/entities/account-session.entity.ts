import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type DeviceType = 'pc' | 'mobile';

@Entity('account_sessions')
@Index('IDX_account_sessions_session_id', ['session_id'], { unique: true })
@Index('IDX_account_sessions_credential_device_active', [
  'credential_id',
  'device_type',
  'is_active',
])
@Index('IDX_account_sessions_expires_at', ['expires_at'])
export class AccountSession {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  /**
   * express-session의 req.sessionID 값
   */
  @Column({ type: 'varchar', length: 128 })
  session_id!: string;

  /**
   * AccountCredential.id
   */
  @Column({ type: 'bigint', unsigned: true })
  credential_id!: string;

  @Column({ type: 'enum', enum: ['pc', 'mobile'] })
  device_type!: DeviceType;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  /**
   * 세션 만료 시각
   */
  @Column({ type: 'datetime', nullable: true })
  expires_at!: Date | null;

  /**
   * 요청 정보(감사/디버깅/정책)
   */
  @Column({ type: 'text', nullable: true })
  user_agent!: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip!: string | null;

  /**
   * 마지막 접근 시각
   */
  @Column({ type: 'datetime', nullable: true })
  last_accessed_at!: Date | null;

  /**
   * 비활성화된 시간(로그아웃/강제로그아웃 추적)
   */
  @Column({ type: 'datetime', nullable: true })
  deactivated_at!: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
