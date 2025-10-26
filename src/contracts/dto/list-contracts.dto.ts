export class ListContractsDto {
  page?: number;
  size?: number;
  q?: string;

  pinId?: number;
  assigneeId?: number;
  hasFiles?: boolean;

  status?: 'ongoing' | 'done' | 'canceled';
  dateFrom?: string; // 'YYYY-MM-DD'
  dateTo?: string; // 'YYYY-MM-DD'
  orderBy?: 'contract_date' | 'created_at'; // 기본: contract_date
  orderDir?: 'ASC' | 'DESC'; // 기본: DESC
}
