import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUnifiedPlanningItems,
  groupPlanningItems,
  getItemsNeedingNotification,
  getTodayDateString,
  getDateOffsetString,
} from './planningCalculations';
import { generateIcsContent } from './icsGenerator';
import { Debt } from '../types/debt';
import { PlanningTask } from '../types/planning';

test('buildUnifiedPlanningItems includes debt due dates and user tasks', () => {
  const asOf = new Date('2026-11-10T12:00:00Z');
  const debts: Debt[] = [
    {
      id: 'd1',
      type: 'on_me_doit',
      personName: 'Kabila',
      phoneNumber: '+243810000000',
      reason: 'Vente terrain',
      proofPhoto: null,
      currency: 'USD',
      initialAmount: 500,
      startDate: '2026-10-01',
      dueDate: '2026-11-10', // Today
      interestType: 'none',
      repayments: [],
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: 'd2',
      type: 'je_dois',
      personName: 'Bakole',
      phoneNumber: '+243990000000',
      reason: '',
      proofPhoto: null,
      currency: 'FC',
      initialAmount: 40000,
      startDate: '2026-10-01',
      dueDate: '2026-11-05', // Overdue
      interestType: 'none',
      repayments: [],
      createdAt: 2,
      updatedAt: 2,
    },
  ];

  const tasks: PlanningTask[] = [
    {
      id: 't1',
      title: 'Rdv Banque Rawbank',
      date: '2026-11-11', // Tomorrow
      time: '14:30',
      note: 'Retrait chèque',
      repetition: 'none',
      completed: false,
      createdAt: 3,
      updatedAt: 3,
    },
  ];

  const items = buildUnifiedPlanningItems(debts, tasks, asOf);
  assert.equal(items.length, 3);

  const groups = groupPlanningItems(items);
  assert.equal(groups.overdue.length, 1);
  assert.equal(groups.overdue[0].personName, 'Bakole');
  assert.equal(groups.today.length, 1);
  assert.equal(groups.today[0].personName, 'Kabila');
  assert.equal(groups.tomorrow.length, 1);
  assert.equal(groups.tomorrow[0].title, 'Rdv Banque Rawbank');
});

test('getItemsNeedingNotification filters items according to leadDays', () => {
  const asOf = new Date('2026-11-10T12:00:00Z');
  const debts: Debt[] = [
    {
      id: 'd1',
      type: 'je_dois',
      personName: 'Fally',
      phoneNumber: '',
      reason: '',
      proofPhoto: null,
      currency: 'USD',
      initialAmount: 200,
      startDate: '2026-10-01',
      dueDate: '2026-11-11', // In 1 day
      interestType: 'none',
      repayments: [],
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: 'd2',
      type: 'je_dois',
      personName: 'Koffi',
      phoneNumber: '',
      reason: '',
      proofPhoto: null,
      currency: 'USD',
      initialAmount: 100,
      startDate: '2026-10-01',
      dueDate: '2026-11-13', // In 3 days
      interestType: 'none',
      repayments: [],
      createdAt: 2,
      updatedAt: 2,
    },
  ];

  const items = buildUnifiedPlanningItems(debts, [], asOf);

  // 1 day before
  const dueTomorrow = getItemsNeedingNotification(items, 1, asOf);
  assert.equal(dueTomorrow.length, 1);
  assert.equal(dueTomorrow[0].personName, 'Fally');

  // 3 days before
  const dueIn3Days = getItemsNeedingNotification(items, 3, asOf);
  assert.equal(dueIn3Days.length, 1);
  assert.equal(dueIn3Days[0].personName, 'Koffi');
});

test('generateIcsContent produces valid VCALENDAR with RRULE support', () => {
  const ics = generateIcsContent({
    id: 'test_123',
    kind: 'custom_task',
    title: 'Rdv Comptable',
    date: '2026-11-15',
    time: '10:00',
    note: 'Bilan trimestriel',
    repetition: 'monthly',
    isOverdue: false,
    isToday: false,
    isTomorrow: false,
    isThisWeek: false,
    isCompleted: false,
  });

  assert.ok(ics.includes('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('BEGIN:VEVENT'));
  assert.ok(ics.includes('SUMMARY:Rdv Comptable'));
  assert.ok(ics.includes('DESCRIPTION:Bilan trimestriel'));
  assert.ok(ics.includes('DTSTART:20261115T100000'));
  assert.ok(ics.includes('RRULE:FREQ=MONTHLY'));
  assert.ok(ics.includes('END:VCALENDAR'));
});
