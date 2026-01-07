import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('api_request_logs')
@Index('IDX_api_request_logs_created_at', ['created_at'])
@Index('IDX_api_request_logs_credential_status', [
  'credential_id',
  'status_code',
])
export class ApiRequestLog {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  credential_id!: string | null;

  @Column({ type: 'enum', enum: ['pc', 'mobile'], nullable: true })
  device_type!: 'pc' | 'mobile' | null;

  @Column({ type: 'varchar', length: 10 })
  method!: string;

  @Column({ type: 'varchar', length: 255 })
  path!: string;

  @Column({ type: 'int', unsigned: true })
  status_code!: number;

  @Column({ type: 'int', unsigned: true })
  duration_ms!: number;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip!: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent!: string | null;

  @Column({ type: 'longtext', nullable: true })
  request_body!: string | null;

  @Column({ type: 'longtext', nullable: true })
  response_body!: string | null;

  @Column({ type: 'longtext', nullable: true })
  query_log!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  error_name!: string | null;

  @Column({ type: 'text', nullable: true })
  error_message!: string | null;

  @Column({ type: 'longtext', nullable: true })
  error_stack!: string | null;
}
