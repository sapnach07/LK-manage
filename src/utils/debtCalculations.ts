import { Debt, DebtSummary, DashboardTotals } from '../types/debt';

/**
 * Calculates calendar months elapsed between startDate and asOfDate.
 * Without compounding: 1 month is counted when a full calendar month has passed.
 */
export function calculateElapsedMonths(startDateStr: string, asOfDate: Date = new Date()): number {
  if (!startDateStr) return 0;
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return 0;

  // Use midnight dates to avoid time of day anomalies
  const startYear = start.getFullYear();
  const startMonth = start.getMonth();
  const startDay = start.getDate();

  const currentYear = asOfDate.getFullYear();
  const currentMonth = asOfDate.getMonth();
  const currentDay = asOfDate.getDate();

  let months = (currentYear - startYear) * 12 + (currentMonth - startMonth);
  if (currentDay < startDay) {
    months--;
  }

  return Math.max(0, months);
}

/**
 * Computes interest amount and descriptive formula for a debt.
 */
export function calculateInterest(
  debt: Pick<Debt, 'initialAmount' | 'interestType' | 'interestRate' | 'interestFixedAmount' | 'currency' | 'startDate'>,
  asOfDate: Date = new Date()
): { interestAmount: number; formulaDescription: string; elapsedMonths: number } {
  const capital = debt.initialAmount || 0;

  switch (debt.interestType) {
    case 'percentage_once': {
      const rate = debt.interestRate ?? 0;
      const amount = (capital * rate) / 100;
      return {
        interestAmount: Math.round(amount * 100) / 100,
        formulaDescription: `${rate}% appliqué une fois sur le capital`,
        elapsedMonths: 0,
      };
    }

    case 'percentage_monthly': {
      const rate = debt.interestRate ?? 0;
      const elapsedMonths = calculateElapsedMonths(debt.startDate, asOfDate);
      const amount = capital * (rate / 100) * elapsedMonths;
      return {
        interestAmount: Math.round(amount * 100) / 100,
        formulaDescription: `${rate}% / mois × ${elapsedMonths} mois révolu${elapsedMonths > 1 ? 's' : ''}`,
        elapsedMonths,
      };
    }

    case 'fixed_amount': {
      const fixed = debt.interestFixedAmount ?? 0;
      return {
        interestAmount: Math.round(fixed * 100) / 100,
        formulaDescription: `Montant fixe de ${formatCurrencyValue(fixed, debt.currency)}`,
        elapsedMonths: 0,
      };
    }

    case 'none':
    default:
      return {
        interestAmount: 0,
        formulaDescription: 'Aucun intérêt',
        elapsedMonths: 0,
      };
  }
}

/**
 * Formats a number with its currency symbol cleanly.
 */
export function formatCurrencyValue(amount: number, currency: 'FC' | 'USD'): string {
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: currency === 'USD' ? 2 : 0,
    minimumFractionDigits: 0,
  }).format(amount);

  return currency === 'USD' ? `${formatted} USD` : `${formatted} FC`;
}

/**
 * Calculates sum of all money additions made to a debt.
 */
export function calculateTotalAdditions(debt: Debt): number {
  return (debt.additions || []).reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
}

/**
 * Computes full summary for a given debt.
 */
export function getDebtSummary(debt: Debt, asOfDate: Date = new Date()): DebtSummary {
  const capital = debt.initialAmount || 0;
  const { interestAmount, formulaDescription, elapsedMonths } = calculateInterest(debt, asOfDate);
  const totalDue = Math.round((capital + interestAmount) * 100) / 100;

  const totalRepaid = (debt.repayments || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const roundedRepaid = Math.round(totalRepaid * 100) / 100;

  const rawBalance = totalDue - roundedRepaid;
  const remainingBalance = rawBalance > 0.001 ? Math.round(rawBalance * 100) / 100 : 0;

  // A debt is settled if remainingBalance is zero and either capital is zero or repayments were made
  const isSettled = remainingBalance === 0 && (totalDue === 0 || roundedRepaid >= totalDue);

  // Check overdue: due date is strictly before today (based on local date string YYYY-MM-DD)
  const todayStr = asOfDate.toISOString().split('T')[0];
  const isOverdue = !isSettled && !!debt.dueDate && debt.dueDate < todayStr;

  const progress = totalDue > 0 ? Math.min(100, Math.round((roundedRepaid / totalDue) * 100)) : 100;

  return {
    capital,
    interest: interestAmount,
    interestFormula: formulaDescription,
    elapsedMonths,
    totalDue,
    totalRepaid: roundedRepaid,
    remainingBalance,
    isSettled,
    isOverdue,
    repaymentProgressPercent: progress,
  };
}

/**
 * Calculates dashboard statistics.
 * NEVER adds FC and USD together - they are kept strictly distinct!
 */
export function calculateDashboardTotals(debts: Debt[], asOfDate: Date = new Date()): DashboardTotals {
  const totals: DashboardTotals = {
    jeDois: { FC: 0, USD: 0 },
    onMeDoit: { FC: 0, USD: 0 },
    overdueCount: 0,
    settledCount: 0,
    totalCount: debts.length,
  };

  for (const debt of debts) {
    const summary = getDebtSummary(debt, asOfDate);

    if (summary.isSettled) {
      totals.settledCount++;
    } else {
      // Add to outstanding balance per type and currency
      if (debt.type === 'je_dois') {
        totals.jeDois[debt.currency] = Math.round((totals.jeDois[debt.currency] + summary.remainingBalance) * 100) / 100;
      } else {
        totals.onMeDoit[debt.currency] = Math.round((totals.onMeDoit[debt.currency] + summary.remainingBalance) * 100) / 100;
      }
    }

    if (summary.isOverdue) {
      totals.overdueCount++;
    }
  }

  return totals;
}

/**
 * Cleans an international phone number to send to wa.me (digits only, keeping country code).
 * Defaults to DRC +243 if national format is typed.
 */
export function sanitizeWhatsAppPhone(phone: string): string {
  if (!phone) return '';
  // Remove spaces, dashes, dots, parentheses
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0')) {
    // Local DRC format: 0812345678 -> 243812345678
    cleaned = '243' + cleaned.substring(1);
  } else if (!cleaned.startsWith('243') && cleaned.length === 9) {
    // 9 digits without leading 0 in DRC -> prepend 243
    cleaned = '243' + cleaned;
  }

  return cleaned.replace(/\D/g, '');
}

/**
 * Generates the default pre-written WhatsApp message template.
 */
export function buildDefaultWhatsAppMessage(debt: Debt, summary: DebtSummary): string {
  const formattedBalance = formatCurrencyValue(summary.remainingBalance, debt.currency);
  const formattedDue = debt.dueDate
    ? new Date(debt.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'non précisée';

  const reasonStr = debt.reason ? ` concernant « ${debt.reason} »` : '';

  if (debt.type === 'on_me_doit') {
    return (
      `Bonjour ${debt.personName},\n\n` +
      `J'espère que tu vas bien. Je te contacte par rapport à notre accord${reasonStr}.\n` +
      `Pour rappel, le solde restant est de ${formattedBalance}.\n` +
      `Date d'échéance convenue : ${formattedDue}.\n\n` +
      `Merci de me tenir informé de tes disponibilités pour le règlement. Bonne journée !`
    );
  } else {
    return (
      `Bonjour ${debt.personName},\n\n` +
      `Je t'écris concernant la somme que je te dois${reasonStr}.\n` +
      `Le solde restant s'élève actuellement à ${formattedBalance} (échéance fixée au ${formattedDue}).\n` +
      `Je prévois de procéder au versement au plus vite. Merci pour ta compréhension et ta patience !`
    );
  }
}
