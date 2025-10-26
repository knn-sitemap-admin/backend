import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

type Range = {
  dateFrom?: string;
  dateTo?: string;
  teamId?: number;
  limit?: number;
};

@Injectable()
export class PerformanceService {
  constructor(private readonly db: DataSource) {}

  // 공통 where 절 유틸
  private addDateRange(
    where: string[],
    params: Record<string, any>,
    df?: string,
    dt?: string,
  ) {
    if (df) {
      where.push('c.contract_date >= :df');
      params.df = df;
    }
    if (dt) {
      where.push('c.contract_date <= :dt');
      params.dt = dt;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 상단 카드
  async summary({ dateFrom, dateTo, teamId }: Range) {
    const where: string[] = [`c.status IN ('ongoing','done','canceled')`];
    const params: any = {};
    this.addDateRange(where, params, dateFrom, dateTo);

    // 팀 필터는 "그 팀에 소속된 담당자가 1명 이상 참여한 계약"만 집계
    if (teamId) {
      where.push(`EXISTS (
        SELECT 1 FROM contract_assignees a
        JOIN accounts ac ON ac.id = a.account_id
        WHERE a.contract_id = c.id AND ac.team_id = :teamId
      )`);
      params.teamId = teamId;
    }

    // 총 계약건수(진행/완료만), 총 최종수당, 총 지원금
    const row = await this.db
      .createQueryBuilder()
      .from('contracts', 'c')
      .select([
        `SUM(CASE WHEN c.status IN ('ongoing','done') THEN 1 ELSE 0 END) AS totalContracts`,
        `COALESCE(SUM(c.grand_total), 0) AS totalFinal`,
        `COALESCE(SUM(c.support_amount), 0) AS totalSupport`,
      ])
      .where(where.join(' AND '), params)
      .getRawOne();

    // 총 인원수: 팀 필터 있으면 해당 팀 인원, 없으면 전체 인원
    const headcountRow = await this.db
      .createQueryBuilder()
      .from('accounts', 'ac')
      .select(`COUNT(DISTINCT ac.id) AS totalEmployees`)
      .where(teamId ? 'ac.team_id = :teamId' : '1=1', teamId ? { teamId } : {})
      .getRawOne();

    return {
      totalContracts: Number(row?.totalContracts ?? 0),
      totalFinal: Number(row?.totalFinal ?? 0),
      totalSupport: Number(row?.totalSupport ?? 0),
      totalEmployees: Number(headcountRow?.totalEmployees ?? 0),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 팀별 막대/파이 + 하단 카드
  async byTeam({ dateFrom, dateTo }: Range) {
    const params: any = {};
    const dateFilter = [
      dateFrom ? 'c.contract_date >= :df' : '1=1',
      dateTo ? 'c.contract_date <= :dt' : '1=1',
    ]
      .filter(Boolean)
      .join(' AND ');
    if (dateFrom) params.df = dateFrom;
    if (dateTo) params.dt = dateTo;

    // 1) 팀별 최종수당(= 개별 분배 합계), 계약/해약 건수, 팀 인원수
    const rows = await this.db.query(
      `
      SELECT
        t.id AS teamId,
        t.name AS teamName,
        COUNT(DISTINCT ac.id) AS headcount,
        COALESCE(SUM(CASE WHEN c.status IN ('ongoing','done') THEN (c.grand_total * a.rate_percent / 100) ELSE 0 END), 0) AS totalFinal,
        COUNT(DISTINCT CASE WHEN c.status IN ('ongoing','done') THEN c.id END) AS contractCount,
        COUNT(DISTINCT CASE WHEN c.status = 'canceled' THEN c.id END) AS canceledCount
      FROM teams t
      LEFT JOIN accounts ac ON ac.team_id = t.id
      LEFT JOIN contract_assignees a ON a.account_id = ac.id
      LEFT JOIN contracts c ON c.id = a.contract_id
        AND ${dateFilter}
      GROUP BY t.id, t.name
      ORDER BY t.id
      `,
      params,
    );

    // 2) 팀별 지원금 합계(중복 집계 방지: 해당 팀 소속 담당자가 1명이라도 참여한 계약만 1회 합산)
    const supportRows = await this.db.query(
      `
      SELECT
        t.id AS teamId,
        COALESCE(SUM(c.support_amount), 0) AS totalSupport
      FROM teams t
      JOIN contracts c
        ON ${dateFilter}
      WHERE EXISTS (
        SELECT 1 FROM contract_assignees a
        JOIN accounts ac ON ac.id = a.account_id
        WHERE a.contract_id = c.id AND ac.team_id = t.id
      )
      GROUP BY t.id
      `,
      params,
    );
    const supportMap = new Map<number, number>(
      supportRows.map((r: any) => [Number(r.teamId), Number(r.totalSupport)]),
    );

    // merge
    return rows.map((r: any) => ({
      teamId: Number(r.teamId),
      teamName: r.teamName,
      headcount: Number(r.headcount ?? 0),
      totalFinal: Math.round(Number(r.totalFinal ?? 0)),
      totalSupport: Math.round(supportMap.get(Number(r.teamId)) ?? 0),
      contractCount: Number(r.contractCount ?? 0),
      canceledCount: Number(r.canceledCount ?? 0),
    }));
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 개인별 랭킹(옵션)
  async byAssignee({ dateFrom, dateTo, teamId, limit = 10 }: Range) {
    const params: any = { limit };
    const dateFilter = [
      dateFrom ? 'c.contract_date >= :df' : '1=1',
      dateTo ? 'c.contract_date <= :dt' : '1=1',
    ]
      .filter(Boolean)
      .join(' AND ');
    if (dateFrom) params.df = dateFrom;
    if (dateTo) params.dt = dateTo;

    const extraTeam = teamId ? 'AND ac.team_id = :teamId' : '';
    if (teamId) params.teamId = teamId;

    const rows = await this.db.query(
      `
      SELECT
        ac.id AS accountId,
        ac.name AS name,
        ac.team_id AS teamId,
        COALESCE(SUM(CASE WHEN c.status IN ('ongoing','done') THEN (c.grand_total * a.rate_percent / 100) ELSE 0 END), 0) AS totalFinal,
        COUNT(DISTINCT CASE WHEN c.status IN ('ongoing','done') THEN c.id END) AS contractCount
      FROM accounts ac
      JOIN contract_assignees a ON a.account_id = ac.id
      JOIN contracts c ON c.id = a.contract_id
        AND ${dateFilter}
      WHERE 1=1 ${extraTeam}
      GROUP BY ac.id, ac.name, ac.team_id
      ORDER BY totalFinal DESC
      LIMIT :limit
      `,
      params,
    );

    return rows.map((r: any) => ({
      accountId: Number(r.accountId),
      name: r.name,
      teamId: Number(r.teamId),
      totalFinal: Math.round(Number(r.totalFinal ?? 0)),
      contractCount: Number(r.contractCount ?? 0),
    }));
  }
}
