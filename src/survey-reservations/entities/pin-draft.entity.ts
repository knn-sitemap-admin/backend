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

  // 매물명
  @Column({ type: 'varchar', length: 255, name: 'name', nullable: true })
  name: string | null = null;

  // 분양사무실 전화번호
  @Column({
    type: 'varchar',
    length: 50,
    name: 'contact_main_phone',
    nullable: true,
  })
  contactMainPhone: string | null = null;

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
