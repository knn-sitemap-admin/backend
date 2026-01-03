import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountCredential } from '../../dashboard/accounts/entities/account-credential.entity';
import { Account } from '../../dashboard/accounts/entities/account.entity';
import { ApiRequestLog } from '../logs/entities/api-request-log.entity';
import { EmployeeApiCountsQueryDto } from './dto/employee-api-counts-query.dto';

type CountRow = {
  credentialId: string;
  pinCreate: number;
  pinUpdate: number;
  draftCreate: number;
  contractCreate: number;
  contractUpdate: number;
};

function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 정책(현재 기준)
 * - 핀(실제핀): POST /pins, PATCH /pins/:id
 * - 임시핀: POST /pin-drafts
 * - 계약: POST /contracts, PATCH /contracts/:id
 *
 * 주의:
 * - path는 query string 제외된 형태로 저장된다고 가정(현재 middleware에서 originalUrl 쓰면 query 포함될 수도 있음)
 *   그래서 아래 조건은 "startsWith" + "method" 조합으로 잡는다.
 */
@Injectable()
export class OwnerEmployeeApiCountsService {
  constructor(
    @InjectRepository(AccountCredential)
    private readonly credRepo: Repository<AccountCredential>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(ApiRequestLog)
    private readonly logRepo: Repository<ApiRequestLog>,
  ) {}

  private isTarget(method: string, path: string): string | null {
    const m = method.toUpperCase();

    // 실핀
    if (m === 'POST' && path === '/pins') return 'pinCreate';
    if (m === 'PATCH' && path.startsWith('/pins/')) return 'pinUpdate';

    // 임시핀
    if (m === 'POST' && path === '/pin-drafts') return 'draftCreate';

    // 계약
    if (m === 'POST' && path === '/contracts') return 'contractCreate';
    if (m === 'PATCH' && path.startsWith('/contracts/'))
      return 'contractUpdate';

    return null;
  }

  async list(dto: EmployeeApiCountsQueryDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;

    // 직원 페이징(credential 기준) - admin 제외
    const [creds, total] = await this.credRepo.findAndCount({
      where: [{ role: 'staff' as any }, { role: 'manager' as any }],
      order: { id: 'ASC' as any },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: ['id', 'email', 'role', 'is_disabled'],
    });

    const credentialIds = creds.map((c) => String(c.id));
    if (credentialIds.length === 0) {
      return { page, pageSize, total, items: [] };
    }

    // account 정보(이름/직급)
    const accounts = await this.accountRepo.find({
      where: credentialIds.map((id) => ({ credential_id: id })),
      select: ['id', 'credential_id', 'name', 'position_rank'],
    });
    const accMap = new Map(accounts.map((a) => [String(a.credential_id), a]));

    // 로그 집계: 현재 페이지에 보이는 직원들만 대상으로 group by
    // NOTE: path 조건은 LIKE로 5개 패턴만 잡아 범위를 줄인다.
    // NOTE: 기간 필터는 아직 없음(요구 없었으니 전체). 나중에 month/day 필터 쉽게 추가 가능.
    const rows = await this.logRepo
      .createQueryBuilder('l')
      .select('l.credential_id', 'credentialId')
      .addSelect(
        "SUM(CASE WHEN l.method='POST' AND l.path='/pins' THEN 1 ELSE 0 END)",
        'pinCreate',
      )
      .addSelect(
        "SUM(CASE WHEN l.method='PATCH' AND l.path LIKE '/pins/%' THEN 1 ELSE 0 END)",
        'pinUpdate',
      )
      .addSelect(
        "SUM(CASE WHEN l.method='POST' AND l.path='/pin-drafts' THEN 1 ELSE 0 END)",
        'draftCreate',
      )
      .addSelect(
        "SUM(CASE WHEN l.method='POST' AND l.path='/contracts' THEN 1 ELSE 0 END)",
        'contractCreate',
      )
      .addSelect(
        "SUM(CASE WHEN l.method='PATCH' AND l.path LIKE '/contracts/%' THEN 1 ELSE 0 END)",
        'contractUpdate',
      )
      .where('l.credential_id IN (:...cids)', { cids: credentialIds })
      .groupBy('l.credential_id')
      .getRawMany();

    const map = new Map<string, CountRow>();
    for (const r of rows) {
      const cid = String(r.credentialId ?? '');
      if (!cid) continue;
      map.set(cid, {
        credentialId: cid,
        pinCreate: toInt(r.pinCreate),
        pinUpdate: toInt(r.pinUpdate),
        draftCreate: toInt(r.draftCreate),
        contractCreate: toInt(r.contractCreate),
        contractUpdate: toInt(r.contractUpdate),
      });
    }

    const items = creds.map((c) => {
      const cid = String(c.id);
      const acc = accMap.get(cid);
      const cnt = map.get(cid) ?? {
        credentialId: cid,
        pinCreate: 0,
        pinUpdate: 0,
        draftCreate: 0,
        contractCreate: 0,
        contractUpdate: 0,
      };

      return {
        credentialId: cid,
        email: c.email,
        role: c.role,
        isDisabled: c.is_disabled,

        accountId: acc ? String(acc.id) : null,
        name: acc?.name ?? null,
        positionRank: (acc as any)?.position_rank ?? null,

        counts: {
          pin: { create: cnt.pinCreate, update: cnt.pinUpdate },
          pinDraft: { create: cnt.draftCreate },
          contract: { create: cnt.contractCreate, update: cnt.contractUpdate },
        },
        total:
          cnt.pinCreate +
          cnt.pinUpdate +
          cnt.draftCreate +
          cnt.contractCreate +
          cnt.contractUpdate,
      };
    });

    // 총합 desc로 보고 싶으면 프론트에서 정렬하거나, 여기서 정렬해도 됨(하지만 페이징이 꼬일 수 있어)
    return { page, pageSize, total, items };
  }
}
