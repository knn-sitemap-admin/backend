export type ResolvedRange = {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  label: string;
};

export type CompanyKpi = {
  grossSales: number; // 매출 = grandTotal 합
  netProfit: number; // 순이익(회사몫) = companyAmount 합
  totalContractCount: number; // 전체 계약 건수 (ongoing, done, canceled, rejected)
  completedContractCount: number; // 완료 계약 건수 (done)
  rejectedContractCount: number; // 부결 계약 건수 (rejected)
  headcount: number; // 전체 인원수(비활성 제외)
};

export type TeamSummary = {
  teamId: string;
  teamName: string;
  grossSales: number; // 팀 기여분 총 매출 합
  netProfit: number; // 팀 기여분 순수익(회사몫) 합
  finalPayout: number; // 팀원 최종수당 합(직원풀 기준)
  totalContractCount: number; // distinct 전체 계약
  completedContractCount: number; // 완료 계약
  rejectedContractCount: number; // 부결 계약
  memberCount: number; // team_members 기준
};

export type TopTeam = {
  teamId: string;
  teamName: string;
  grossSales: number;
  netProfit: number;
  finalPayout: number;
  totalContractCount: number;
  completedContractCount: number;
  rejectedContractCount: number;
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
  grossSales: number; // 개인 기여분 총 매출 합
  netProfit: number; // 개인 기여분 순수익(회사몫) 합
  finalPayout: number; // 본인 수당 합
  totalContractCount: number;
  completedContractCount: number;
  rejectedContractCount: number;
};

export type TeamEmployeesResponse = {
  resolvedRange: ResolvedRange;
  team: { teamId: string; teamName: string };
  employees: TeamEmployeeItem[];
};

export type EmployeeMonthlyStat = {
  year: number;
  month: number;
  grossSales: number; // 개인 매출 기여
  netProfit: number; // 회사 수익 기여
  finalPayout: number; // 본인 수익
  totalContractCount: number;
  completedContractCount: number;
  rejectedContractCount: number;
};

export type EmployeePerformanceResponse = {
  accountId: string;
  name: string | null;
  positionRank: string | null;
  monthlyStats: EmployeeMonthlyStat[];
};
