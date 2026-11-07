import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPin,
  createBackupPayload,
  parseAndValidateBackup,
  mergeDebts,
  mergeTasks,
} from './securityAndBackup';
import { Debt } from '../types/debt';
import { PlanningTask } from '../types/planning';

test('hashPin generates consistent SHA-256 hex string', async () => {
  const hash1 = await hashPin('1234');
  const hash2 = await hashPin('1234');
  const hashOther = await hashPin('4321');

  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 64); // SHA-256 64 hex characters
  assert.notEqual(hash1, hashOther);
});

test('createBackupPayload and parseAndValidateBackup roundtrip', () => {
  const debts: Debt[] = [
    {
      id: 'd1',
      type: 'je_dois',
      personName: 'Patrick',
      phoneNumber: '+243810000000',
      reason: 'Achat moto',
      proofPhoto: 'data:image/jpeg;base64,samplephoto123',
      currency: 'USD',
      initialAmount: 600,
      startDate: '2026-10-01',
      dueDate: '2026-12-01',
      interestType: 'none',
      repayments: [],
      createdAt: 100,
      updatedAt: 100,
    },
  ];

  const tasks: PlanningTask[] = [
    {
      id: 't1',
      title: 'Appel avocat',
      date: '2026-11-20',
      repetition: 'none',
      completed: false,
      createdAt: 100,
      updatedAt: 100,
    },
  ];

  const jsonStr = createBackupPayload(debts, tasks);
  const parsed = parseAndValidateBackup(jsonStr);

  assert.equal(parsed.debts.length, 1);
  assert.equal(parsed.debts[0].personName, 'Patrick');
  assert.equal(parsed.debts[0].proofPhoto, 'data:image/jpeg;base64,samplephoto123');
  assert.equal(parsed.tasks.length, 1);
  assert.equal(parsed.tasks[0].title, 'Appel avocat');
});

test('mergeDebts adds new debts and updates matching debts', () => {
  const current: Debt[] = [
    {
      id: 'd1',
      type: 'je_dois',
      personName: 'Patrick',
      phoneNumber: '',
      reason: 'Version 1',
      proofPhoto: null,
      currency: 'USD',
      initialAmount: 100,
      startDate: '2026-01-01',
      dueDate: '2026-02-01',
      interestType: 'none',
      repayments: [],
      createdAt: 10,
      updatedAt: 20,
    },
  ];

  const imported: Debt[] = [
    {
      id: 'd1',
      type: 'je_dois',
      personName: 'Patrick',
      phoneNumber: '',
      reason: 'Version 2 updated',
      proofPhoto: null,
      currency: 'USD',
      initialAmount: 100,
      startDate: '2026-01-01',
      dueDate: '2026-02-01',
      interestType: 'none',
      repayments: [],
      createdAt: 10,
      updatedAt: 30, // Newer
    },
    {
      id: 'd2',
      type: 'on_me_doit',
      personName: 'Sarah',
      phoneNumber: '',
      reason: 'New debt',
      proofPhoto: null,
      currency: 'FC',
      initialAmount: 50000,
      startDate: '2026-01-01',
      dueDate: '2026-02-01',
      interestType: 'none',
      repayments: [],
      createdAt: 15,
      updatedAt: 15,
    },
  ];

  const merged = mergeDebts(current, imported);
  assert.equal(merged.length, 2);
  const d1 = merged.find((d) => d.id === 'd1')!;
  assert.equal(d1.reason, 'Version 2 updated');
});
