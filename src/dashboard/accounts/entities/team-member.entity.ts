import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Team } from './team.entity';
import { Account } from './account.entity';

export type TeamRole = 'owner' | 'manager' | 'staff';

@Entity('team_members')
export class TeamMember {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ type: 'bigint', unsigned: true })
  team_id!: string;

  @ManyToOne(() => Team)
  @JoinColumn({ name: 'team_id' })
  team!: Team;

  @Column({ type: 'bigint', unsigned: true })
  account_id!: string;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'account_id' })
  account!: Account;

  @Column({ type: 'enum', enum: ['manager', 'staff'] })
  team_role!: TeamRole;

  @Column({ type: 'boolean', default: false })
  is_primary!: boolean;

  @Column({ type: 'date', nullable: true })
  joined_at!: string | null;
}
