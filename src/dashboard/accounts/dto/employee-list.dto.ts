import { PositionRank } from '../entities/account.entity';

export type EmployeeListItemDto = {
  accountId: string;

  profileUrl: string | null;
  name: string | null;
  positionRank: PositionRank | null;
  teamName: string; // 없으면 "미소속"
  phone: string | null;

  reservedPinDrafts: Array<{
    id: string;
    name: string | null;
    addressLine: string;
    reservedDate: string;
  }>;

  favoritePins: Array<{
    id: string;
    name: string | null;
  }>;

  ongoingContracts: Array<{
    id: number;
    contractNo: string;
    customerName: string;
    contractDate: string;
  }>;
};
