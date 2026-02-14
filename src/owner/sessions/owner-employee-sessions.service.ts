import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountCredential } from '../../dashboard/accounts/entities/account-credential.entity';
import { Account } from '../../dashboard/accounts/entities/account.entity';
import { AccountSession } from '../../dashboard/auth/entities/account-session.entity';
import { EmployeeSessionListQueryDto } from './dto/employee-session-list-query.dto';

@Injectable()
export class OwnerEmployeeSessionsService {
  constructor(
    @InjectRepository(AccountCredential)
    private readonly credRepo: Repository<AccountCredential>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(AccountSession)
    private readonly sessionRepo: Repository<AccountSession>,
  ) {}

  async listEmployeesWithSessions(dto: EmployeeSessionListQueryDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;

    // 직원(credential) 기준 페이징: admin 제외
    const [creds, total] = await this.credRepo.findAndCount({
      where: { role: 'staff' as any }, // manager도 포함하려면 아래 where로 교체
      // where: [{ role: 'staff' as any }, { role: 'manager' as any }],
      order: { id: 'ASC' as any },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: ['id', 'email', 'role', 'is_disabled'],
    });

    // account 정보(이름/직급)
    const accounts = await this.accountRepo.find({
      where: creds.map((c) => ({ credential_id: String(c.id) })),
      select: ['id', 'credential_id', 'name', 'position_rank'],
    });
    const accMap = new Map(accounts.map((a) => [String(a.credential_id), a]));

    // 세션은 pc/mobile 각각 최신 1개(활성)만 있으면 충분
    const credentialIds = creds.map((c) => String(c.id));
    const sessions = credentialIds.length
      ? await this.sessionRepo
          .createQueryBuilder('s')
          .where('s.credential_id IN (:...cids)', { cids: credentialIds })
          .andWhere('s.is_active = 1')
          .orderBy('s.last_accessed_at', 'DESC')
          .getMany()
      : [];

    const byCred = new Map<
      string,
      { pc?: AccountSession; mobile?: AccountSession }
    >();
    for (const s of sessions) {
      const cid = String(s.credential_id);
      const cur = byCred.get(cid) ?? {};
      if (s.device_type === 'pc' && !cur.pc) cur.pc = s;
      if (s.device_type === 'mobile' && !cur.mobile) cur.mobile = s;
      byCred.set(cid, cur);
      if (cur.pc && cur.mobile) continue;
    }

    const items = creds.map((c) => {
      const cid = String(c.id);
      const acc = accMap.get(cid);

      const pack = byCred.get(cid) ?? {};
      const pc = pack.pc ?? null;
      const mobile = pack.mobile ?? null;

      return {
        credentialId: cid,
        email: c.email,
        role: c.role,
        isDisabled: c.is_disabled,

        accountId: acc ? String(acc.id) : null,
        name: acc?.name ?? null,
        positionRank: (acc as any)?.position_rank ?? null,

        sessions: {
          pc: pc
            ? {
                sessionId: String(pc.session_id),
                isActive: pc.is_active,
                lastAccessedAt: pc.last_accessed_at
                  ? pc.last_accessed_at.toISOString()
                  : null,
                expiresAt: pc.expires_at ? pc.expires_at.toISOString() : null,
                ip: pc.ip ?? null,
                userAgent: pc.user_agent ?? null,
              }
            : null,
          mobile: mobile
            ? {
                sessionId: String(mobile.session_id),
                isActive: mobile.is_active,
                lastAccessedAt: mobile.last_accessed_at
                  ? mobile.last_accessed_at.toISOString()
                  : null,
                expiresAt: mobile.expires_at
                  ? mobile.expires_at.toISOString()
                  : null,
                ip: mobile.ip ?? null,
                userAgent: mobile.user_agent ?? null,
              }
            : null,
        },
      };
    });

    return { page, pageSize, total, items };
  }
}
