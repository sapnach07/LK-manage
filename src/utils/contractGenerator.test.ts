import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildContractFullText,
  buildContractFullTextV1,
  buildContractFullTextV2,
  buildAmendmentFullText,
  buildAmendmentFullTextV1,
  buildAmendmentFullTextV2,
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

test('buildContractFullTextV2 generates short one-page contract with calculated amounts in figures', () => {
  const sampleContract: Omit<Contract, 'contractText' | 'contentDigest'> = {
    id: 'ctr_test_2',
    debtId: 'debt_2',
    contractNumber: 'CTR-2026-0002',
    templateVersion: 'v2',
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
    },
    principalAmount: 1000,
    currency: 'USD',
    startDate: '2026-11-08',
    deliveryMethods: ['especes', 'mobile_money'],
    interestType: 'percentage_once',
    interestRate: 10, // 10% on 1000 = 100$, total = 1100$
    hasDueDate: true,
    dueDate: '2026-12-08',
    latePenalty: {
      enabled: true,
      rate: 2, // 2% on 1000 = 20$
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

  const text = buildContractFullText(sampleContract, { shortLegalClausesEnabled: true });
  // Normalize non-breaking spaces for cross-platform/node comparisons
  const clean = (s: string) => s.replace(/[\u202f\u00a0]/g, ' ');
  const normalizedText = clean(text);

  // Title
  assert.ok(normalizedText.includes('RECONNAISSANCE DE DETTE N° CTR-2026-0002'));

  // Main recognition sentence
  assert.ok(normalizedText.includes('Je soussigné(e) Patrick MUKENDI, demeurant au 12 Av. Kasavubu, Bandalungwa, tél. +243990000000, reconnais avoir reçu de Jean-Luc KABILA'));
  assert.ok(normalizedText.includes('1 000 $ (mille dollars américains)'));
  assert.ok(normalizedText.includes('espèces, mobile money'));

  // Remboursement
  assert.ok(normalizedText.includes("REMBOURSEMENT : Je m'engage à rembourser cette somme au plus tard le 8 décembre 2026."));

  // Intérêt avec tous les montants calculés
  assert.ok(normalizedText.includes('INTÉRÊT : un intérêt de 10 % appliqué une seule fois, soit 100 $, donc 1 100 $ au total.'));

  // Retard calculé
  assert.ok(normalizedText.includes('EN CAS DE RETARD : Si je ne rembourse pas à la date prévue, une pénalité de 2 % par mois s\'ajoute, soit 20 $ par mois, après relance du prêteur.'));

  // Autres sommes et Remboursements
  assert.ok(normalizedText.includes('AUTRES SOMMES : Si je reçois d\'autres sommes, chacune est notée dans un avenant daté que je signe.'));
  assert.ok(normalizedText.includes('REMBOURSEMENTS : Chaque remboursement est noté avec sa date et réduit d\'abord les intérêts, puis la somme prêtée.'));

  // Clauses juridiques courtes optionnelles
  assert.ok(normalizedText.includes('PREUVE : Cet écrit et nos signatures électroniques ont valeur de preuve (ordonnance-loi n° 23/010 du 13 mars 2023, Code du numérique). LITIGE : tribunaux compétents de Kinshasa. Droit congolais.'));

  // Witness
  assert.ok(normalizedText.includes('Témoin : Alain TSHIBANDA.'));
});

test('buildAmendmentFullTextV2 generates short 5-line amendment', () => {
  const sampleContract: Contract = {
    id: 'ctr_test_2',
    debtId: 'debt_2',
    contractNumber: 'CTR-2026-0002',
    templateVersion: 'v2',
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
    signedAt: '15 novembre 2026 à 10:00',
    newPrincipalTotal: 1500,
  });

  const clean = (s: string) => s.replace(/[\u202f\u00a0]/g, ' ');
  const normalizedAmendment = clean(amendmentText);

  assert.ok(normalizedAmendment.includes('AVENANT N° 1 au contrat N° CTR-2026-0002.'));
  assert.ok(normalizedAmendment.includes('Patrick MUKENDI reçoit de Jean-Luc KABILA une somme supplémentaire de 500 $.'));
  assert.ok(normalizedAmendment.includes('Motif : Complément transport.'));
  assert.ok(normalizedAmendment.includes('Nouveau total : 1 500 $.'));
  assert.ok(normalizedAmendment.includes('Les autres conditions du contrat ne changent pas.'));
});

test('buildContractFullText preserves legacy v1 contract when templateVersion is v1', () => {
  const sampleContractV1: Omit<Contract, 'contractText' | 'contentDigest'> = {
    id: 'ctr_legacy_1',
    debtId: 'debt_1',
    contractNumber: 'CTR-2026-0001',
    templateVersion: 'v1',
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
    },
    principalAmount: 5000,
    currency: 'USD',
    startDate: '2026-11-08',
    deliveryMethods: ['especes'],
    interestType: 'none',
    hasDueDate: false,
    lenderSignature: 'data:lender',
    borrowerSignature: 'data:borrower',
    amendments: [],
  };

  const text = buildContractFullText(sampleContractV1);
  assert.ok(text.includes("CONTRAT DE PRÊT D'ARGENT N° CTR-2026-0001 (acte sous seing privé)"));
  assert.ok(text.includes('Art. 1 Objet :'));
  assert.ok(text.includes('Art. 2 Remise des fonds :'));
});
