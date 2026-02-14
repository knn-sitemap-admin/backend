export type CalcInput = {
  brokerageFee: number;
  vatEnabled: boolean;
  rebateUnits: number;
  supportAmount: number;
  isTaxed: boolean;
  companyPercent: number;
};

export type CalcResult = {
  vatAmount: number;
  rebateAmount: number;
  delta: number;
  taxedDelta: number;
  grandTotal: number;
  companyAmount: number;
  staffPoolAmount: number;
};

const TAX_FACTOR = 0.967;
const VAT_RATE = 0.1;
const REBATE_UNIT_AMOUNT = 1_000_000;

export function calcContractMoney(input: CalcInput): CalcResult {
  const vatAmount = input.vatEnabled
    ? Math.round(input.brokerageFee * VAT_RATE)
    : 0;

  const rebateAmount = input.rebateUnits * REBATE_UNIT_AMOUNT;

  const delta = rebateAmount - input.supportAmount;

  const taxedDelta = input.isTaxed ? Math.round(delta * TAX_FACTOR) : delta;

  const grandTotal = input.brokerageFee + vatAmount + taxedDelta;

  const companyAmount = Math.round(grandTotal * (input.companyPercent / 100));
  const staffPoolAmount = grandTotal - companyAmount;

  return {
    vatAmount,
    rebateAmount,
    delta,
    taxedDelta,
    grandTotal,
    companyAmount,
    staffPoolAmount,
  };
}
