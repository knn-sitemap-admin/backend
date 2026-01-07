import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountCredential } from '../accounts/entities/account-credential.entity';
import { BcryptService } from '../../common/hashing/bcrypt.service';
import { Account } from '../accounts/entities/account.entity';
import { AccountSession } from './entities/account-session.entity';

type SigninResult = {
  credentialId: string;
  role: 'admin' | 'manager' | 'staff';
};

type DeviceType = 'pc' | 'mobile';

type RegisterSessionInput = {
  sessionId: string;
  credentialId: string;
  deviceType: DeviceType;
  userAgent?: string | null;
  ip?: string | null;
};

type RegisterSessionResult = {
  newSessionId: string;
  oldSessionIds: string[];
  expiresAt: Date;
};

type ValidateSessionInput = {
  sessionId: string;
  credentialId: string;
  deviceType: DeviceType;
};

type ValidateSessionResult =
  | { ok: true; role: 'admin' | 'manager' | 'staff' }
  | {
      ok: false;
      reason:
        | 'NO_CREDENTIAL'
        | 'DISABLED'
        | 'NO_SESSION'
        | 'EXPIRED'
        | 'MISMATCH';
    };

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AccountCredential)
    private readonly accountCredentialRepository: Repository<AccountCredential>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    private readonly bcrypt: BcryptService,
    @InjectRepository(AccountSession)
    private readonly accountSessionRepository: Repository<AccountSession>,
  ) {}

  private isManagerRank(rank: string | null | undefined): boolean {
    return rank === 'TEAM_LEADER' || rank === 'DIRECTOR';
  }

  private async resolveEffectiveRole(
    credentialId: string,
  ): Promise<'admin' | 'manager' | 'staff'> {
    const cred = await this.accountCredentialRepository.findOne({
      where: { id: credentialId },
      select: ['id', 'role', 'is_disabled'],
    });

    if (!cred) throw new UnauthorizedException('인증 실패');
    if (cred.is_disabled) throw new UnauthorizedException('인증 실패');

    if (cred.role === 'admin') return 'admin';

    const acc = await this.accountRepository.findOne({
      where: { credential_id: credentialId },
      select: ['id', 'position_rank'],
    });

    const rank = acc?.position_rank ?? null;
    return this.isManagerRank(rank ?? undefined) ? 'manager' : 'staff';
  }

  async validateActiveSession(
    input: ValidateSessionInput,
  ): Promise<ValidateSessionResult> {
    // 1) credential 존재/비활성 체크
    const cred = await this.accountCredentialRepository.findOne({
      where: { id: input.credentialId },
      select: ['id', 'role', 'is_disabled'],
    });

    if (!cred) return { ok: false, reason: 'NO_CREDENTIAL' };
    if (cred.is_disabled) return { ok: false, reason: 'DISABLED' };

    // 2) 세션 row 존재/활성 체크
    const row = await this.accountSessionRepository.findOne({
      where: { session_id: input.sessionId },
    });

    if (!row || !row.is_active) return { ok: false, reason: 'NO_SESSION' };

    // 3) 세션 소유/디바이스 일치 검증
    if (String(row.credential_id) !== String(input.credentialId)) {
      return { ok: false, reason: 'MISMATCH' };
    }
    if (row.device_type !== input.deviceType) {
      return { ok: false, reason: 'MISMATCH' };
    }

    // 4) 만료 검증
    if (row.expires_at && row.expires_at.getTime() <= Date.now()) {
      await this.deactivateSessionBySessionId(input.sessionId); // 만료면 DB도 정리
      return { ok: false, reason: 'EXPIRED' };
    }

    // 5) 접근 시간 업데이트(best-effort)
    await this.accountSessionRepository.update(row.id, {
      last_accessed_at: new Date(),
    });

    // 6) effective role 계산(직급 기반 포함)
    const effectiveRole = await this.resolveEffectiveRole(
      String(input.credentialId),
    );

    return { ok: true, role: effectiveRole };
  }

  async deactivateSessionBySessionId(sessionId: string): Promise<void> {
    const now = new Date();
    await this.accountSessionRepository
      .createQueryBuilder()
      .update(AccountSession)
      .set({ is_active: false, deactivated_at: now })
      .where('session_id = :sid AND is_active = 1', { sid: sessionId })
      .execute();
  }

  private getSessionExpiresAt(): Date {
    const hours = Number(process.env.SESSION_TTL_HOURS ?? 6); // 기본 6시간
    const ms = 1000 * 60 * 60 * (Number.isFinite(hours) ? hours : 6);
    return new Date(Date.now() + ms);
  }

  async registerSession(
    input: RegisterSessionInput,
  ): Promise<RegisterSessionResult> {
    const now = new Date();
    const expiresAt = this.getSessionExpiresAt();

    return this.accountSessionRepository.manager.transaction(async (tx) => {
      const repo = tx.getRepository(AccountSession);

      // 1) 기존 활성 세션들(같은 계정 + 같은 deviceType) 전부 잠그고 조회
      //    꼬임/동시로그인으로 active가 여러개여도 전부 정리한다.
      const olds = await repo
        .createQueryBuilder('s')
        .setLock('pessimistic_write')
        .where('s.credential_id = :cid', { cid: input.credentialId })
        .andWhere('s.device_type = :dt', { dt: input.deviceType })
        .andWhere('s.is_active = 1')
        .getMany();

      const oldSessionIds = olds.map((o) => String(o.session_id));

      // 2) 기존 세션들 전부 비활성화
      if (olds.length > 0) {
        await repo
          .createQueryBuilder()
          .update(AccountSession)
          .set({ is_active: false, deactivated_at: now })
          .where('credential_id = :cid', { cid: input.credentialId })
          .andWhere('device_type = :dt', { dt: input.deviceType })
          .andWhere('is_active = 1')
          .execute();
      }

      // 3) 새 세션 row 생성
      const created = repo.create({
        session_id: input.sessionId,
        credential_id: input.credentialId,
        device_type: input.deviceType,
        is_active: true,
        expires_at: expiresAt,
        user_agent: input.userAgent ?? null,
        ip: input.ip ?? null,
        last_accessed_at: now,
        deactivated_at: null,
      });

      await repo.save(created);

      return {
        newSessionId: String(created.session_id),
        oldSessionIds,
        expiresAt,
      };
    });
  }

  async bootstrapAdmin(email: string, password: string, tokenHeader?: string) {
    const token = process.env.ADMIN_BOOTSTRAP_TOKEN ?? '';
    if (!token || tokenHeader !== token) {
      throw new ForbiddenException('부트스트랩 토큰 불일치');
    }

    const adminCount = await this.accountCredentialRepository.count({
      where: { role: 'admin' },
    });
    if (adminCount > 0) {
      throw new ForbiddenException('이미 관리자 계정이 존재합니다');
    }

    const hashed = await this.bcrypt.hash(password);

    const exists = await this.accountCredentialRepository.findOne({
      where: { email },
    });
    if (exists) {
      await this.accountCredentialRepository.update(exists.id, {
        password: hashed,
        role: 'admin',
        is_disabled: false,
      });
      return {
        credentialId: String(exists.id),
        role: 'admin' as const,
        created: false,
        updated: true,
      };
    }

    const created = await this.accountCredentialRepository.save(
      this.accountCredentialRepository.create({
        email,
        password: hashed,
        role: 'admin',
        is_disabled: false,
      }),
    );

    await this.accountRepository.save(
      this.accountRepository.create({
        credential_id: created.id,
      }),
    );

    return {
      credentialId: String(created.id),
      role: 'admin' as const,
      created: true,
      updated: false,
    };
  }

  async signin(email: string, password: string): Promise<SigninResult> {
    const credential = await this.accountCredentialRepository.findOne({
      where: { email },
    });
    if (!credential || credential.is_disabled) {
      throw new UnauthorizedException('인증 실패');
    }
    const ok = await this.bcrypt.compare(password, credential.password);
    if (!ok) {
      throw new UnauthorizedException('인증 실패');
    }

    const effectiveRole = await this.resolveEffectiveRole(
      String(credential.id),
    );

    return {
      credentialId: credential.id,
      role: effectiveRole,
    };
  }

  async resetPasswordWithBootstrapToken(
    tokenHeader: string | undefined,
    email: string,
    newPassword: string,
  ) {
    const token = process.env.ADMIN_BOOTSTRAP_TOKEN ?? '';
    if (!token || tokenHeader !== token) {
      throw new ForbiddenException('부트스트랩 토큰 불일치');
    }

    const cred = await this.accountCredentialRepository.findOne({
      where: { email },
    });
    if (!cred) throw new NotFoundException('계정을 찾을 수 없습니다.');

    const hashed = await this.bcrypt.hash(newPassword);
    await this.accountCredentialRepository.update(cred.id, {
      password: hashed,
    });

    return { credentialId: String(cred.id) };
  }

  async forceResetPasswordByAdmin(email: string, newPassword: string) {
    const cred = await this.accountCredentialRepository.findOne({
      where: { email },
    });
    if (!cred) throw new NotFoundException('계정을 찾을 수 없습니다.');

    const hashed = await this.bcrypt.hash(newPassword);
    await this.accountCredentialRepository.update(cred.id, {
      password: hashed,
    });

    return { credentialId: String(cred.id) };
  }

  async hasAdminOrAccount1(): Promise<boolean> {
    const adminCount = await this.accountCredentialRepository.count({
      where: { role: 'admin' },
    });

    if (adminCount > 0) return true;

    const account1 = await this.accountRepository.findOne({
      where: { id: '1' },
    });

    return !!account1;
  }
}
