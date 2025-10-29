import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type TeamOverview = {
  teamId: string;
  teamName: string;
  memberCount: number;
  contractCount: number;
  canceledCount: number;
  supportAmount: number;
  finalAmount: number;
};

export type SalesOverviewResp = {
  summary: {
    totalContracts: number;
    totalFinalAmount: number;
    totalSupportAmount: number;
    totalEmployees: number;
  };
  teams: TeamOverview[];
  charts: {
    barByTeam: Array<{
      teamName: string;
      finalAmount: number;
      supportAmount: number;
    }>;
    pieShareByTeam: Array<{ teamName: string; ratio: number }>;
  };
};

@Injectable()
export class ReportsService {
  constructor(private readonly ds: DataSource) {}

  async getSalesOverview() {
    const [{ totalContracts = 0 } = {}] = await this.ds.query(`
      SELECT COUNT(*) AS totalContracts
      FROM contracts c
      WHERE c.status IN ('ongoing','done') 
    `);
    const [{ totalSupportAmount = 0 } = {}] = await this.ds.query(`
      SELECT COALESCE(SUM(c.supportAmount),0) AS totalSupportAmount
      FROM contracts c
      WHERE c.status IN ('ongoing','done')
    `);
    const [{ totalFinalAmount = 0 } = {}] = await this.ds.query(`
      SELECT COALESCE(SUM(a.finalAmount),0) AS totalFinalAmount
      FROM contract_assignees a
      JOIN contracts c ON c.id=a.contract_id
      WHERE a.role='staff' AND c.status IN ('ongoing','done')
    `);
    const [{ totalEmployees = 0 } = {}] = await this.ds.query(`
      SELECT COUNT(DISTINCT tm.account_id) AS totalEmployees
      FROM team_members tm
      WHERE tm.is_primary=1
    `);
    const summary = {
      totalContracts: Number(totalContracts),
      totalFinalAmount: Number(totalFinalAmount),
      totalSupportAmount: Number(totalSupportAmount),
      totalEmployees: Number(totalEmployees),
    };
    const teams = await this.ds.query(`
      SELECT
        t.id AS teamId,
        t.name AS teamName,
        COUNT(DISTINCT tm.account_id) AS memberCount,
        COUNT(DISTINCT CASE WHEN c.status IN ('ongoing','done') THEN c.id END) AS contractCount,
        COUNT(DISTINCT CASE WHEN c.status='canceled' THEN c.id END) AS canceledCount,
        COALESCE(SUM(CASE WHEN c.status IN ('ongoing','done') THEN c.supportAmount END),0) AS supportAmount,
        COALESCE(SUM(CASE WHEN c.status IN ('ongoing','done') AND a.role='staff' THEN a.finalAmount END),0) AS finalAmount
      FROM teams t
      LEFT JOIN team_members tm ON tm.team_id=t.id AND tm.is_primary=1
      LEFT JOIN contract_assignees a ON a.account_id=tm.account_id
      LEFT JOIN contracts c ON c.id=a.contract_id
      GROUP BY t.id,t.name
      ORDER BY t.id ASC
    `);
    const barByTeam = teams.map((t: any) => ({
      teamName: t.teamName,
      finalAmount: Number(t.finalAmount ?? 0),
      supportAmount: Number(t.supportAmount ?? 0),
    }));
    const totalForRatio =
      barByTeam.reduce((sum, t) => sum + t.finalAmount, 0) || 1;
    const pieShareByTeam = barByTeam.map((t) => ({
      teamName: t.teamName,
      ratio: t.finalAmount / totalForRatio,
    }));
    return { summary, teams, charts: { barByTeam, pieShareByTeam } };
  }
}
