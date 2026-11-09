import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateElapsedMonths,
  calculateInterest,
  getDebtSummary,
  calculateDashboardTotals,
  sanitizeWhatsAppPhone,
  buildDefaultWhatsAppMessage,
  calculateTotalAdditions,
} from './debtCalculations';
import { Debt } from '../types/debt';

test('calculateElapsedMonths returns 0 for future or same month dates', () => {
  const asOf = new Date('2026-03-15T12:00:00Z');
  assert.equal(calculateElapsedMonths('2026-03-15', asOf), 0);
  assert.equal(calculateElapsedMonths('2026-03-20', asOf), 0);
  assert.equal(calculateElapsedMonths('2026-04-01', asOf), 0);
});

test('calculateElapsedMonths correctly counts full elapsed calendar months', () => {
  const asOf = new Date('2026-03-15T12:00:00Z');
  // Exactly 2 months: 2026-01-15 to 2026-03-15
  assert.equal(calculateElapsedMonths('2026-01-15', asOf), 2);
  // 1 month because 16th is after 15th: 2026-01-16 to 2026-03-15
  assert.equal(calculateElapsedMonths('2026-01-16', asOf), 1);
  // 1 year (12 months): 2025-03-15 to 2026-03-15
  assert.equal(calculateElapsedMonths('2025-03-15', asOf), 12);
});

test('calculateInterest handles (1) Aucun', () => {
  const res = calculateInterest({
    initialAmount: 1000,
    interestType: 'none',
    currency: 'USD',
    startDate: '2026-01-01',
  });
  assert.equal(res.interestAmount, 0);
  assert.equal(res.formulaDescription, 'Aucun intérêt');
});

test('calculateInterest handles (2) Pourcentage unique', () => {
  const res = calculateInterest({
    initialAmount: 500,
    interestType: 'percentage_once',
    interestRate: 10,
    currency: 'USD',
    startDate: '2026-01-01',
  });
  assert.equal(res.interestAmount, 50); // 10% of 500
});

test('calculateInterest handles (3) Pourcentage mensuel simple sans composition', () => {
  const asOf = new Date('2026-04-01T12:00:00Z');
  const res = calculateInterest(
    {
      initialAmount: 100000,
      interestType: 'percentage_monthly',
      interestRate: 5,
      currency: 'FC',
      startDate: '2026-01-01',
    },
    asOf
  );
  // 3 months elapsed * 5% = 15% of 100000 = 15000 FC
  assert.equal(res.elapsedMonths, 3);
  assert.equal(res.interestAmount, 15000);
});

test('calculateInterest handles (4) Montant fixe ajouté', () => {
  const res = calculateInterest({
    initialAmount: 200,
    interestType: 'fixed_amount',
    interestFixedAmount: 30,
    currency: 'USD',
    startDate: '2026-01-01',
  });
  assert.equal(res.interestAmount, 30);
});

test('getDebtSummary calculates repayments, remaining balance, and settled status', () => {
  const debt: Debt = {
    id: 'd1',
    type: 'on_me_doit',
    personName: 'Michel K.',
    phoneNumber: '+243810000000',
    reason: 'Prêt commerce',
    proofPhoto: null,
    currency: 'USD',
    initialAmount: 200,
    startDate: '2026-01-01',
    dueDate: '2026-05-01',
    interestType: 'fixed_amount',
    interestFixedAmount: 20,
    repayments: [
      { id: 'r1', amount: 50, date: '2026-02-01', createdAt: 1 },
      { id: 'r2', amount: 70, date: '2026-03-01', createdAt: 2 },
    ],
    createdAt: 100,
    updatedAt: 100,
  };

  const summary = getDebtSummary(debt, new Date('2026-03-15'));
  assert.equal(summary.capital, 200);
  assert.equal(summary.interest, 20);
  assert.equal(summary.totalDue, 220);
  assert.equal(summary.totalRepaid, 120);
  assert.equal(summary.remainingBalance, 100);
  assert.equal(summary.isSettled, false);
  assert.equal(summary.isOverdue, false);

  // When fully repaid
  const fullyRepaidDebt: Debt = {
    ...debt,
    repayments: [
      ...debt.repayments,
      { id: 'r3', amount: 100, date: '2026-03-10', createdAt: 3 },
    ],
  };
  const settledSummary = getDebtSummary(fullyRepaidDebt, new Date('2026-03-15'));
  assert.equal(settledSummary.remainingBalance, 0);
  assert.equal(settledSummary.isSettled, true);
});

test('getDebtSummary detects overdue debts when dueDate passed and remaining balance > 0', () => {
  const overdueDebt: Debt = {
    id: 'd2',
    type: 'je_dois',
    personName: 'Sarah B.',
    phoneNumber: '+243990000000',
    reason: 'Dépannage',
    proofPhoto: null,
    currency: 'FC',
    initialAmount: 50000,
    startDate: '2026-01-01',
    dueDate: '2026-02-01', // Overdue relative to 2026-03-15
    interestType: 'none',
    repayments: [],
    createdAt: 100,
    updatedAt: 100,
  };

  const summary = getDebtSummary(overdueDebt, new Date('2026-03-15'));
  assert.equal(summary.isOverdue, true);
  assert.equal(summary.isSettled, false);
});

test('calculateDashboardTotals keeps FC and USD strictly separated', () => {
  const debts: Debt[] = [
    {
      id: '1',
      type: 'je_dois',
      personName: 'A',
      phoneNumber: '',
      reason: '',
      proofPhoto: null,
      currency: 'USD',
      initialAmount: 100,
      startDate: '2026-01-01',
      dueDate: '2026-01-15',
      interestType: 'none',
      repayments: [{ id: 'p1', amount: 20, date: '2026-01-05', createdAt: 1 }],
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: '2',
      type: 'je_dois',
      personName: 'B',
      phoneNumber: '',
      reason: '',
      proofPhoto: null,
      currency: 'FC',
      initialAmount: 50000,
      startDate: '2026-01-01',
      dueDate: '2026-04-01',
      interestType: 'none',
      repayments: [],
      createdAt: 2,
      updatedAt: 2,
    },
    {
      id: '3',
      type: 'on_me_doit',
      personName: 'C',
      phoneNumber: '',
      reason: '',
      proofPhoto: null,
      currency: 'USD',
      initialAmount: 300,
      startDate: '2026-01-01',
      dueDate: '2026-02-01',
      interestType: 'none',
      repayments: [],
      createdAt: 3,
      updatedAt: 3,
    },
    {
      id: '4',
      type: 'on_me_doit',
      personName: 'D',
      phoneNumber: '',
      reason: '',
      proofPhoto: null,
      currency: 'FC',
      initialAmount: 120000,
      startDate: '2026-01-01',
      dueDate: '2026-05-01',
      interestType: 'none',
      repayments: [],
      createdAt: 4,
      updatedAt: 4,
    },
  ];

  const totals = calculateDashboardTotals(debts, new Date('2026-03-01'));
  assert.equal(totals.jeDois.USD, 80); // 100 - 20
  assert.equal(totals.jeDois.FC, 50000);
  assert.equal(totals.onMeDoit.USD, 300);
  assert.equal(totals.onMeDoit.FC, 120000);
  assert.equal(totals.overdueCount, 2); // id 1 and id 3 have dueDate < 2026-03-01
  assert.equal(totals.totalCount, 4);
});

test('sanitizeWhatsAppPhone formats international numbers and defaults to +243', () => {
  assert.equal(sanitizeWhatsAppPhone('+243 81 234 56 78'), '243812345678');
  assert.equal(sanitizeWhatsAppPhone('0812345678'), '243812345678');
  assert.equal(sanitizeWhatsAppPhone('812345678'), '243812345678');
  assert.equal(sanitizeWhatsAppPhone('+33 6 12 34 56 78'), '33612345678');
});

test('buildDefaultWhatsAppMessage includes balance, reason, and due date', () => {
  const debt: Debt = {
    id: 'd1',
    type: 'on_me_doit',
    personName: 'Patrick',
    phoneNumber: '+243812345678',
    reason: 'Frais de transport',
    proofPhoto: null,
    currency: 'USD',
    initialAmount: 75,
    startDate: '2026-01-01',
    dueDate: '2026-03-01',
    interestType: 'none',
    repayments: [],
    createdAt: 1,
    updatedAt: 1,
  };

  const summary = getDebtSummary(debt, new Date('2026-03-02'));
  const msg = buildDefaultWhatsAppMessage(debt, summary);
  assert.ok(msg.includes('Patrick'));
  assert.ok(msg.includes('Frais de transport'));
  assert.ok(msg.includes('75 USD'));
});

test('calculateTotalAdditions sums all added amounts with associated notes', () => {
  const debtWithAdditions: Debt = {
    id: 'd1',
    type: 'on_me_doit',
    personName: 'Alain',
    phoneNumber: '+243810000000',
    reason: 'Prêt initial',
    proofPhoto: null,
    currency: 'USD',
    initialAmount: 150,
    startDate: '2026-01-01',
    dueDate: '2026-02-01',
    interestType: 'none',
    repayments: [],
    additions: [
      { id: 'a1', amount: 30, date: '2026-01-10', reason: 'Frais de transport', createdAt: 1 },
      { id: 'a2', amount: 20, date: '2026-01-15', reason: 'Achat fournitures', createdAt: 2 },
    ],
    createdAt: 1,
    updatedAt: 1,
  };

  assert.equal(calculateTotalAdditions(debtWithAdditions), 50);
});
