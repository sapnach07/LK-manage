export type DebtType = 'je_dois' | 'on_me_doit';

export type Currency = 'FC' | 'USD';

export type InterestType =
  | 'none'                // (1) Aucun
  | 'percentage_once'     // (2) Pourcentage unique appliqué une seule fois sur le capital
  | 'percentage_monthly'  // (3) Pourcentage mensuel simple appliqué au capital initial pour chaque mois écoulé, sans composition
  | 'fixed_amount';       // (4) Montant fixe ajouté

export interface Repayment {
  id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  note?: string;
  createdAt: number;
}

export interface Debt {
  id: string;
  type: DebtType;
  personName: string;
  phoneNumber: string; // Format international (ex: +243XXXXXXXXX)
  reason: string; // Motif / note libre
  proofPhoto: string | null; // Image base64 compressée (<= 800px)
  currency: Currency; // 'FC' | 'USD' (strictement séparés)
  initialAmount: number; // Capital initial
  startDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  interestType: InterestType;
  interestRate?: number; // Pourcentage (ex: 10 pour 10%)
  interestFixedAmount?: number; // Montant fixe ajouté
  repayments: Repayment[];
  isUnsigned?: boolean; // Set to true when borrower refused/cancelled signing
  createdAt: number;
  updatedAt: number;
}

export interface DebtSummary {
  capital: number;
  interest: number;
  interestFormula: string;
  elapsedMonths: number;
  totalDue: number;
  totalRepaid: number;
  remainingBalance: number;
  isSettled: boolean;
  isOverdue: boolean;
  repaymentProgressPercent: number;
}

export interface DashboardTotals {
  jeDois: {
    FC: number;
    USD: number;
  };
  onMeDoit: {
    FC: number;
    USD: number;
  };
  overdueCount: number;
  settledCount: number;
  totalCount: number;
}
