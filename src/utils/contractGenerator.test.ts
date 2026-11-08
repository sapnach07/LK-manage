import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildContractFullText,
  buildAmendmentFullText,
  computeSha256Digest,
  generateContractNumber,
} from './contractGenerator';
import { Contract } from '../types/contract';

test('generateContractNumber generates sequential format', () => {
  const num1 = generateContractNumber(0);
  const num2 = generateContractNumber(5);
  assert.match(num1, /^CTR-\d{4}-0001$/);
  assert.match(num2, /^CTR-\d{4}-0006$/);
});

test('computeSha256Digest produces consistent 64-char hex string', async () => {
  const text = 'CONTRAT TEST CONTENT';
  const digest1 = await computeSha256Digest(text);
  const digest2 = await computeSha256Digest(text);
  assert.equal(digest1, digest2);
  assert.equal(digest1.length, 64);
});

test('buildContractFullText contains exact articles and French amount in words', () => {
  const sampleContract: Omit<Contract, 'contractText' | 'contentDigest'> = {
    id: 'ctr_test_1',
    debtId: 'debt_1',
    contractNumber: 'CTR-2026-0001',
    createdAt: 100,
    signedAt: '8 novembre 2026 à 14:30',
    isLocked: true,
    status: 'active',
    lender: {
      fullName: 'Jean-Luc KABILA',
      address: '45 Av. de la Paix, Gombe',
      phone: '+243810000000',
      city: 'Kinshasa',
      jurisdictionCity: 'Kinshasa',
    },
    borrower: {
      fullName: 'Patrick MUKENDI',
      address: '12 Av. Kasavubu, Bandalungwa',
      phone: '+243990000000',
      identity: {
        enabled: true,
        type: 'carte_electeur',
        number: '1234567890',
      },
    },
    principalAmount: 12500,
    currency: 'USD',
    startDate: '2026-11-08',
    deliveryMethods: ['especes', 'mobile_money'],
    interestType: 'percentage_monthly',
    interestRate: 5,
    hasDueDate: true,
    dueDate: '2026-12-08',
    latePenalty: {
      enabled: true,
      rate: 2,
      period: 'mois',
    },
    witness: {
      enabled: true,
      fullName: 'Alain TSHIBANDA',
    },
    lenderSignature: 'data:image/png;base64,lender',
    borrowerSignature: 'data:image/png;base64,borrower',
    witnessSignature: 'data:image/png;base64,witness',
    amendments: [],
  };

  const text = buildContractFullText(sampleContract);

  // Check required clauses
  assert.ok(text.includes("CONTRAT DE PRÊT D'ARGENT N° CTR-2026-0001"));
  assert.ok(text.includes('Le PRÊTEUR : Jean-Luc KABILA'));
  assert.ok(text.includes('L\'EMPRUNTEUR : Patrick MUKENDI'));
  assert.ok(text.includes('douze mille cinq cents dollars américains'));
  assert.ok(text.includes('ordonnance-loi n° 23/010 du 13 mars 2023'));
  assert.ok(text.includes('Kinshasa'));
  assert.ok(text.includes('Alain TSHIBANDA'));
});

test('buildAmendmentFullText reflects added amount and new total', () => {
  const sampleContract: Contract = {
    id: 'ctr_test_1',
    debtId: 'debt_1',
    contractNumber: 'CTR-2026-0001',
    createdAt: 100,
    signedAt: '8 novembre 2026',
    isLocked: true,
    status: 'active',
    lender: {
      fullName: 'Jean-Luc KABILA',
      address: 'Gombe',
      phone: '+243810000000',
      city: 'Kinshasa',
      jurisdictionCity: 'Kinshasa',
    },
    borrower: {
      fullName: 'Patrick MUKENDI',
      address: 'Bandal',
      phone: '+243990000000',
    },
    principalAmount: 1000,
    currency: 'USD',
    startDate: '2026-11-08',
    deliveryMethods: ['especes'],
    interestType: 'none',
    hasDueDate: false,
    contentDigest: 'dummy',
    contractText: 'dummy',
    lenderSignature: 'data:...',
    borrowerSignature: 'data:...',
    amendments: [],
  };

  const amendmentText = buildAmendmentFullText({
    contract: sampleContract,
    amendmentNumber: 1,
    addedAmount: 500,
    reason: 'Complément transport',
    date: '2026-11-15',
    signedAt: '15 novembre 2026',
    newPrincipalTotal: 1500,
  });

  assert.ok(amendmentText.includes('AVENANT N° 1 AU CONTRAT DE PRÊT D\'ARGENT N° CTR-2026-0001'));
  assert.ok(amendmentText.includes('cinq cents dollars américains'));
  assert.ok(amendmentText.includes('mille cinq cents dollars américains'));
  assert.ok(amendmentText.includes('Complément transport'));
});
