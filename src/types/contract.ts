import { Currency } from './debt';

export type DeliveryMethod = 'especes' | 'mobile_money' | 'virement_bancaire';

export interface BorrowerIdentity {
  enabled: boolean;
  type: 'carte_electeur' | 'passeport' | 'permis_conduire' | 'autre';
  number: string;
}

export interface LatePenalty {
  enabled: boolean;
  rate: number; // e.g. 2 for 2%
  period: 'jour' | 'semaine' | 'mois';
}

export interface Witness {
  enabled: boolean;
  fullName: string;
  signature?: string; // Data URL PNG
}

export interface LenderProfile {
  fullName: string;
  address: string;
  phone: string;
  city: string; // Default: 'Kinshasa'
  signature: string; // Data URL PNG, saved once
  defaultNoticeDays: number; // Default: 7
  defaultJurisdiction: string; // Default: 'Kinshasa'
  minReadingTimeSeconds?: number; // Default: 20 seconds, 0 to disable
  shortLegalClausesEnabled?: boolean; // Default: false (Clauses juridiques courtes)
}

export interface Amendment {
  id: string;
  contractId: string;
  templateVersion?: 'v1' | 'v2'; // 'v1' (old) or 'v2' (new short 5-line)
  amendmentNumber: number; // 1, 2, 3...
  addedAmount: number;
  reason: string;
  date: string; // YYYY-MM-DD
  signedAt: string; // ISO date-time
  readCompletedAt?: string; // e.g. "08 novembre 2026 à 16:30"
  newPrincipalTotal: number;
  contentDigest: string; // SHA-256
  amendmentText: string;
  borrowerSignature: string;
  lenderSignature: string;
  witnessSignature?: string;
}

export interface Contract {
  id: string; // e.g. "ctr_1731..."
  debtId: string;
  contractNumber: string; // e.g. "CTR-2026-0001"
  templateVersion?: 'v1' | 'v2'; // 'v1' (old full articles) or 'v2' (new short one-page)
  createdAt: number;
  signedAt: string; // Human date & time or ISO string
  readCompletedAt?: string; // Date and time when reading was completed
  isLocked: boolean; // Locked immediately after signature
  status: 'active' | 'cancelled';
  cancellationReason?: string;
  cancelledAt?: string;

  // Lender details at signing time
  lender: {
    fullName: string;
    address: string;
    phone: string;
    city: string;
    jurisdictionCity: string;
  };

  // Borrower details
  borrower: {
    fullName: string;
    address: string;
    phone: string;
    identity?: BorrowerIdentity;
  };

  // Loan terms
  debtType?: 'on_me_doit' | 'je_dois'; // 'on_me_doit' (default) or 'je_dois'
  principalAmount: number;
  currency: Currency; // 'FC' | 'USD'
  startDate: string; // YYYY-MM-DD
  deliveryMethods: DeliveryMethod[];
  
  // Interest
  interestType: 'none' | 'percentage_once' | 'percentage_monthly' | 'fixed_amount';
  interestRate?: number;
  fixedInterestAmount?: number;

  // Repayment terms
  hasDueDate: boolean;
  dueDate?: string; // YYYY-MM-DD if hasDueDate
  noticeDays?: number; // Days notice if no dueDate (default: 7)

  // Late penalty (only if hasDueDate)
  latePenalty?: LatePenalty;

  // Witness
  witness?: Witness;

  // Digest & exact text
  contentDigest: string; // SHA-256 fingerprint of the contract content
  contractText: string;

  // Signatures (Data URLs)
  lenderSignature: string;
  borrowerSignature: string;
  witnessSignature?: string;

  // Amendments
  amendments: Amendment[];
}
