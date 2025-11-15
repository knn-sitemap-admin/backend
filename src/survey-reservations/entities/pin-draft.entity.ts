import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

@Entity({ name: 'pin_drafts' })
export class PinDraft {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Index()
  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lat!: string;

  @Index()
  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lng!: string;

  @Column({ type: 'text', name: 'address_line' })
  addressLine!: string;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({
    type: 'bigint',
    unsigned: true,
    name: 'creator_id',
    nullable: true,
  })
  creatorId: string | null = null;
}
