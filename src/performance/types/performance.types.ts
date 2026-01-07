export type ResolvedRange = {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  label: string;
};

export type CompanyKpi = {
  grossSales: number; // 매출 = grandTotal 합
  netProfit: number; // 순이익(회사몫) = companyAmount 합
  contractCount: number; // 완료 계약 건수
  headcount: number; // 전체 인원수(비활성 제외)
};

export type TeamSummary = {
  teamId: string;
  teamName: string;
  finalPayout: number; // 팀원 최종수당 합(직원풀 기준)
  contractCount: number; // distinct 계약
  memberCount: number; // team_members 기준
};

export type TopTeam = {
  teamId: string;
  teamName: string;
  finalPayout: number;
  contractCount: number;
  rank: 1 | 2 | 3;
};

export type PerformanceSummaryResponse = {
  resolvedRange: ResolvedRange;
  company: CompanyKpi;
  teams: TeamSummary[];
  topTeams: TopTeam[];
};

export type TeamEmployeeItem = {
  accountId: string;
  name: string | null;
  positionRank: string | null;
  finalPayout: number;
  contractCount: number; // distinct 계약
};

export type TeamEmployeesResponse = {
  resolvedRange: ResolvedRange;
  team: { teamId: string; teamName: string };
  employees: TeamEmployeeItem[];
};
