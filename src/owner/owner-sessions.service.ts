import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountSession } from '../dashboard/auth/entities/account-session.entity';
import { SESSION_STORE } from '../common/session-store/session-store.provider';
import { ForceLogoutDeviceType } from './dto/force-logout.dto';

type SessionStoreLike = {
  destroy: (sid: string, cb: (err?: unknown) => void) => void;
};

@Injectable()
export class OwnerSessionsService {
  constructor(
    @InjectRepository(AccountSession)
    private readonly sessionRepo: Repository<AccountSession>,
    @Inject(SESSION_STORE)
    private readonly store: SessionStoreLike | null,
  ) {}

  private destroyBySid(sid: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.store || !sid) return resolve();
      this.store.destroy(sid, () => resolve()); // best-effort
    });
  }

  async forceLogout(input: {
    credentialId: string;
    deviceType?: ForceLogoutDeviceType;
  }) {
    const deviceTypes =
      input.deviceType && input.deviceType !== 'all'
        ? [input.deviceType]
        : (['pc', 'mobile'] as const);

    const rows = await this.sessionRepo.find({
      where: deviceTypes.map((dt) => ({
        credential_id: input.credentialId,
        device_type: dt,
        is_active: true,
      })),
      order: { id: 'DESC' as any },
    });

    if (rows.length === 0) {
      throw new NotFoundException('활성 세션이 없습니다.');
    }

    // 1) Redis store 세션 삭제
    for (const s of rows) {
      await this.destroyBySid(String(s.session_id));
    }

    // 2) DB 비활성화
    const now = new Date();
    await this.sessionRepo
      .createQueryBuilder()
      .update(AccountSession)
      .set({ is_active: false, deactivated_at: now })
      .where('credential_id = :cid', { cid: input.credentialId })
      .andWhere('device_type IN (:...dts)', { dts: deviceTypes })
      .andWhere('is_active = 1')
      .execute();

    return { count: rows.length };
  }
}
