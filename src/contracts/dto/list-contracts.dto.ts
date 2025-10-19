export class ListContractsDto {
  page?: number; // default 1
  size?: number; // default 20, max 100

  pinId?: number;
  q?: string; // 고객/분양/영업자명 키워드

  dateFrom?: string; // 'YYYY-MM-DD'
  dateTo?: string; // 'YYYY-MM-DD'

  assigneeId?: number; // 담당자 필터
  hasFiles?: boolean; // 파일 유/무
}
