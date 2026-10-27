export interface SplitInput<P> {
  party: P;
  amount: number;
}

export interface SplitOutput<P> {
  party: P;
  amount: number;
  method: "Cash" | "Bank Account";
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export const allocateSplit = <P>(lines: SplitInput<P>[], cashPart: number): SplitOutput<P>[] => {
  let cashLeft = round2(cashPart);
  const out: SplitOutput<P>[] = [];
  for (const l of lines) {
    const cash = round2(Math.min(cashLeft, l.amount));
    cashLeft = round2(cashLeft - cash);
    const bank = round2(l.amount - cash);
    if (cash > 0) out.push({ party: l.party, amount: cash, method: "Cash" });
    if (bank > 0) out.push({ party: l.party, amount: bank, method: "Bank Account" });
  }
  return out;
};

export interface SavedLine {
  partyId: string;
  amount: number;
  method: "Cash" | "Bank Account";
}

export interface RemainingState {
  amounts: Record<string, string>;
  cash: string;
  bank: string;
}

const left = (current: string, spent: number) => {
  const next = round2((parseFloat(current) || 0) - spent);
  return next > 0.004 ? String(next) : "";
};

export const remainingAfterSave = (
  state: RemainingState,
  saved: SavedLine[],
  isSplit: boolean
): RemainingState => {
  const amounts = { ...state.amounts };
  let cashSaved = 0;
  let bankSaved = 0;
  for (const s of saved) {
    amounts[s.partyId] = left(amounts[s.partyId] ?? "", s.amount);
    if (s.method === "Cash") cashSaved += s.amount;
    else bankSaved += s.amount;
  }
  return {
    amounts,
    cash: isSplit ? left(state.cash, cashSaved) : state.cash,
    bank: isSplit ? left(state.bank, bankSaved) : state.bank,
  };
};

export const isSplitBalanced = (cashPart: number, bankPart: number, total: number) =>
  Math.abs(cashPart + bankPart - total) <= 0.01;
