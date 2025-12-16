import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Index('UQ_teams_leader_account_id', { unique: true })
  @Column({ type: 'bigint', unsigned: true, nullable: true })
  leader_account_id!: string | null;

  @Column({ type: 'varchar', length: 100, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;
}
