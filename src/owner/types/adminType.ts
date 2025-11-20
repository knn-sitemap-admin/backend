// 공통 필터/정렬 타입
export type StatusFilter = 'all' | 'ongoing' | 'done' | 'canceled';

export type PeriodFilter =
  | 'today'
  | 'week'
  | 'month'
  | 'quarter'
  | 'half'
  | 'year'
  | 'custom';

export type SortKey = 'contractDate' | 'grandTotal' | 'createdAt';
export type SortDir = 'asc' | 'desc';

/* ----------------------------------------------------
 * 계약 리스트 관련
 * --------------------------------------------------*/

export type ContractListFilter = {
  status: StatusFilter;
  period: PeriodFilter;
  from?: string;
  to?: string;
  qCustomer?: string;
  qSalesperson?: string;
  qTeam?: string;
  sort: SortKey;
  dir: SortDir;
  page: number;
  pageSize: number;

  idFrom?: number;
  idTo?: number;
  grandMin?: number;
  grandMax?: number;
};

export type ContractListItem = {
  id: number;
  status: 'ongoing' | 'done' | 'canceled';
  statusLabel: string;
  contractDate: string;
  customerName: string | null;
  customerPhone: string | null;
  salespersonName: string | null;
  teamName: string | null;
  brokerageTotal: number;
  rebateTotal: number;
  supportAmount: number;
  grandTotal: number;
};

export type ContractListResult = {
  items: ContractListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
};

/* ----------------------------------------------------
 * 대시보드 상단 요약
 * --------------------------------------------------*/

export type DashboardSummary = {
  ongoingCount: number;
  todayDone: number;
  weekDone: number;
  monthDone: number;
};

/* ----------------------------------------------------
 * 매출/정산 (Finance)
 * --------------------------------------------------*/

export type FinancePeriodFilter = PeriodFilter;

export type FinanceFilter = {
  period: FinancePeriodFilter;
  from?: string;
  to?: string;
  qTeam?: string;
  qSalesperson?: string;
};

export type FinanceSummary = {
  // 선택된 기간 동안의 계약 기준
  totalContracts: number; // 완료된 계약 건수 (distinct contract)
  totalAmount: number; // 분배 총액 (회사+사원) 합계
  companyAmount: number; // 회사 몫 합계 (role = company)
  staffAmount: number; // 사원 몫 합계 (role = staff)
};

export type FinanceBySalesperson = {
  salespersonId: number | null;
  salespersonName: string | null;
  teamName: string | null;
  contractCount: number; // 이 사람이 참여한 계약 수
  totalAmount: number; // 이 사람이 가져간 금액 합계
};

export type FinanceByTeam = {
  teamId: number | null;
  teamName: string | null;
  contractCount: number; // 이 팀 소속 사원들이 참여한 계약 수
  totalAmount: number; // 이 팀 소속 사원들의 금액 합계
};

export type FinanceResult = {
  summary: FinanceSummary;
  bySalesperson: FinanceBySalesperson[];
  byTeam: FinanceByTeam[];
};

/* ----------------------------------------------------
 * 사원/팀 실적
 * --------------------------------------------------*/

export type PerformanceFilter = {
  period: PeriodFilter;
  from?: string;
  to?: string;
  qTeam?: string;
  qSalesperson?: string;
};

export type StaffContractPerformanceRow = {
  salespersonId: number | null;
  salespersonName: string | null;
  teamName: string | null;
  contractCount: number;
};

export type TeamContractPerformanceRow = {
  teamId: number | null;
  teamName: string | null;
  contractCount: number;
};

export type StaffSurveyPerformanceRow = {
  accountId: number | null;
  accountName: string | null;
  teamName: string | null;
  surveyCount: number;
};

export type StaffScheduledSurveyRow = {
  accountId: number | null;
  accountName: string | null;
  teamName: string | null;
  scheduledCount: number;
};

export type PerformanceResult = {
  contractsByStaff: StaffContractPerformanceRow[];
  contractsByTeam: TeamContractPerformanceRow[];
  surveysByStaff: StaffSurveyPerformanceRow[];
  scheduledByStaff: StaffScheduledSurveyRow[];
};

/* ----------------------------------------------------
 * 핀 통계
 * --------------------------------------------------*/

export type PinCityFilter = 'all' | 'seoul' | 'incheon' | 'gyeonggi';

export type PinStatsFilter = {
  city: PinCityFilter;
  period: PeriodFilter;
  from?: string;
  to?: string;
};

export type PinCityStat = {
  cityKey: PinCityFilter | 'other';
  cityLabel: string;
  count: number;
};

export type PinDistrictStat = {
  district: string;
  count: number;
};

export type PinStatsSummary = {
  totalPins: number;
  topCityLabel: string | null;
  topCityCount: number;
  totalDraftBefore: number;
  totalScheduled: number;
};

export type PinStatsResult = {
  filter: PinStatsFilter;
  cityStats: PinCityStat[];
  districtStats: PinDistrictStat[];
  draftBeforeStats: PinDistrictStat[];
  scheduledStats: PinDistrictStat[];
  summary: PinStatsSummary;
};
