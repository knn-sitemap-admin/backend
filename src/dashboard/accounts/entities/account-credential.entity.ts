import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

export type Role = 'admin' | 'manager' | 'staff';

@Entity('account_credentials')
@Unique(['email'])
export class AccountCredential {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  password!: string;

  @Column({ type: 'enum', enum: ['admin', 'manager', 'staff'] })
  role!: Role;

  @Column({ type: 'boolean', default: false })
  is_disabled!: boolean;
}
