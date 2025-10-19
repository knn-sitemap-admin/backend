export class CreateContractDto {
  pinId?: number;

  customerName?: string;
  customerPhone?: string;

  distributorName?: string;
  distributorPhone?: string;

  salespersonName?: string;
  salespersonPhone?: string;

  brokerageFee: number;
  vat: number;
  brokerageTotal: number;

  rebateTotal: number;
  supportAmount: number;

  isTaxed: boolean;
  calcMemo?: string;

  grandTotal: number;

  urls?: string[];
}
