import { Contract } from '../types/contract';
import { formatAmountInWords } from './numberToWords';

/**
 * Formats a sequential contract number like "CTR-2026-0001".
 */
export function generateContractNumber(count: number = 0): string {
  const year = new Date().getFullYear();
  const sequence = String(count + 1).padStart(4, '0');
  return `CTR-${year}-${sequence}`;
}

/**
 * Formats delivery methods list into readable French.
 */
export function formatDeliveryMethodsList(methods: string[]): string {
  if (!methods || methods.length === 0) return 'espèces';
  const labels: Record<string, string> = {
    especes: 'espèces',
    mobile_money: 'mobile money',
    virement_bancaire: 'virement bancaire',
  };
  return methods.map((m) => labels[m] || m).join(', ');
}

/**
 * Formats borrower identity string if provided.
 */
export function formatBorrowerIdentityText(contract: {
  borrower: {
    identity?: {
      enabled: boolean;
      type: string;
      number: string;
    };
  };
}): string {
  if (!contract.borrower.identity?.enabled || !contract.borrower.identity.number?.trim()) {
    return '';
  }
  const typeMap: Record<string, string> = {
    carte_electeur: "carte d'électeur",
    passeport: 'passeport',
    permis_conduire: 'permis de conduire',
    autre: 'pièce d’identité',
  };
  const typeName = typeMap[contract.borrower.identity.type] || 'pièce d’identité';
  return `, titulaire de la ${typeName} n° ${contract.borrower.identity.number.trim()}`;
}

/**
 * Computes a SHA-256 hex digest of a string using the Web Crypto API.
 */
export async function computeSha256Digest(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Formats amounts cleanly with currency for text.
 */
function fmtAmt(val: number, cur: string): string {
  const symbol = cur === 'USD' ? '$' : 'FC';
  return `${val.toLocaleString('fr-FR')} ${symbol}`;
}

/**
 * Generates the v2 short one-page loan contract ("RECONNAISSANCE DE DETTE").
 * All amounts are calculated in numbers and plain simple French language.
 */
export function buildContractFullTextV2(
  contract: Omit<Contract, 'contractText' | 'contentDigest'>,
  options?: { shortLegalClausesEnabled?: boolean }
): string {
  const isJeDois = contract.debtType === 'je_dois';
  const cur = contract.currency;
  const symbol = cur === 'USD' ? '$' : 'FC';
  const capital = contract.principalAmount;
  const amountDigits = fmtAmt(capital, cur);
  const amountWords = formatAmountInWords(capital, cur);
  const deliveryStr = formatDeliveryMethodsList(contract.deliveryMethods);

  // Inverted roles when debtType === 'je_dois'
  // On me doit: Borrower is other party, Lender is user
  // Je dois: Borrower is user (recognizing receiving funds), Lender is other party
  const borrowerName = contract.borrower.fullName.trim();
  const borrowerAddress = contract.borrower.address.trim();
  const borrowerPhone = contract.borrower.phone.trim();

  const lenderName = contract.lender.fullName.trim();
  const lenderAddress = contract.lender.address.trim();
  const lenderPhone = contract.lender.phone.trim();

  // Date of funds delivery
  const formattedDate = new Date(contract.startDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Clause 1: Remboursement
  let remboursementClause = '';
  if (contract.hasDueDate && contract.dueDate) {
    const formattedDue = new Date(contract.dueDate).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    remboursementClause = `REMBOURSEMENT : Je m'engage à rembourser cette somme au plus tard le ${formattedDue}.`;
  } else {
    const notice = contract.noticeDays ?? 7;
    remboursementClause = `REMBOURSEMENT : Je rembourserai cette somme sur demande du prêteur, avec un préavis de ${notice} jours.`;
  }

  // Clause 2: Intérêt avec tous les montants calculés
  let interetClause = 'INTÉRÊT : aucun.';
  if (contract.interestType === 'percentage_once') {
    const rate = contract.interestRate ?? 0;
    const interestAmt = Math.round(((capital * rate) / 100) * 100) / 100;
    const totalAmt = Math.round((capital + interestAmt) * 100) / 100;
    interetClause = `INTÉRÊT : un intérêt de ${rate} % appliqué une seule fois, soit ${fmtAmt(interestAmt, cur)}, donc ${fmtAmt(totalAmt, cur)} au total.`;
  } else if (contract.interestType === 'percentage_monthly') {
    const rate = contract.interestRate ?? 0;
    const monthlyAmt = Math.round(((capital * rate) / 100) * 100) / 100;
    interetClause = `INTÉRÊT : un intérêt de ${rate} % par mois, soit ${fmtAmt(monthlyAmt, cur)} par mois sur la somme prêtée.`;
  } else if (contract.interestType === 'fixed_amount') {
    const fixedAmt = contract.fixedInterestAmount ?? 0;
    interetClause = `INTÉRÊT : un montant fixe de ${fmtAmt(fixedAmt, cur)} en plus.`;
  }

  // Clause 3: En cas de retard
  let retardClause = 'EN CAS DE RETARD : Aucune pénalité n\'est prévue.';
  if (contract.hasDueDate && contract.latePenalty?.enabled) {
    const rate = contract.latePenalty.rate;
    const period = contract.latePenalty.period === 'semaine' ? 'semaine' : contract.latePenalty.period === 'mois' ? 'mois' : 'jour';
    const penaltyAmt = Math.round(((capital * rate) / 100) * 100) / 100;
    retardClause = `EN CAS DE RETARD : Si je ne rembourse pas à la date prévue, une pénalité de ${rate} % par ${period} s'ajoute, soit ${fmtAmt(penaltyAmt, cur)} par ${period}, après relance du prêteur.`;
  }

  // Optional legal clauses
  const shortLegal = options?.shortLegalClausesEnabled
    ? `\nPREUVE : Cet écrit et nos signatures électroniques ont valeur de preuve (ordonnance-loi n° 23/010 du 13 mars 2023, Code du numérique). LITIGE : tribunaux compétents de ${contract.lender.jurisdictionCity || 'Kinshasa'}. Droit congolais.`
    : '';

  // Witness line if enabled
  const witnessLine = contract.witness?.enabled && contract.witness.fullName.trim()
    ? `\nTémoin : ${contract.witness.fullName.trim()}.`
    : '';

  const city = contract.lender.city || 'Kinshasa';

  return `RECONNAISSANCE DE DETTE N° ${contract.contractNumber}

Je soussigné(e) ${borrowerName}, demeurant au ${borrowerAddress}, tél. ${borrowerPhone}, reconnais avoir reçu de ${lenderName}, demeurant au ${lenderAddress}, tél. ${lenderPhone}, la somme de ${amountDigits} (${amountWords}), le ${formattedDate}, par ${deliveryStr}.

${remboursementClause}

${interetClause}

${retardClause}

AUTRES SOMMES : Si je reçois d'autres sommes, chacune est notée dans un avenant daté que je signe.

REMBOURSEMENTS : Chaque remboursement est noté avec sa date et réduit d'abord les intérêts, puis la somme prêtée.${shortLegal}${witnessLine}

Fait à ${city}, le ${contract.signedAt}.

Signatures :
- L'Emprunteur : ${borrowerName} (${isJeDois ? 'signature électronique enregistrée' : 'signature électronique apposée'})
- Le Prêteur : ${lenderName} (${isJeDois ? 'signature électronique apposée' : 'signature électronique enregistrée'})${
    contract.witness?.enabled && contract.witness.fullName.trim()
      ? `\n- Le Témoin : ${contract.witness.fullName.trim()} (signature apposée)`
      : ''
  }`;
}

/**
 * Builds the v1 legacy contract full text (maintained for backwards compatibility).
 */
export function buildContractFullTextV1(contract: Omit<Contract, 'contractText' | 'contentDigest'>): string {
  const currencySymbol = contract.currency === 'USD' ? '$' : 'FC';
  const amountDigits = `${contract.principalAmount.toLocaleString('fr-FR')} ${currencySymbol}`;
  const amountWords = formatAmountInWords(contract.principalAmount, contract.currency);

  const deliveryStr = formatDeliveryMethodsList(contract.deliveryMethods);
  const borrowerIdStr = formatBorrowerIdentityText(contract);

  // Art 3: Remboursement
  let art3Text = '';
  if (contract.hasDueDate && contract.dueDate) {
    const formattedDue = new Date(contract.dueDate).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    art3Text = `remboursable au plus tard le ${formattedDue}. Les paiements partiels sont admis et constatés dans le relevé.`;
  } else {
    const notice = contract.noticeDays ?? 7;
    art3Text = `remboursable sur demande du Prêteur, avec un préavis de ${notice} jours. Les paiements partiels sont admis et constatés dans le relevé.`;
  }

  // Art 4: Intérêts
  let art4Text = 'aucun intérêt.';
  if (contract.interestType === 'percentage_once') {
    art4Text = `taux de ${contract.interestRate ?? 0} % appliqué une seule fois sur le capital.`;
  } else if (contract.interestType === 'percentage_monthly') {
    art4Text = `taux de ${contract.interestRate ?? 0} % par mois, simple, calculé sur chaque somme remise à compter de sa date sans composition.`;
  }

  // Art 7: Retard
  let art7Text = 'aucun intérêt moratoire ou pénalité particulière convenue, les parties s’en remettant au droit commun.';
  if (contract.hasDueDate && contract.latePenalty?.enabled) {
    const periodName = contract.latePenalty.period === 'jour' ? 'jour' : contract.latePenalty.period === 'semaine' ? 'semaine' : 'mois';
    art7Text = `à défaut de paiement à l'échéance convenue, une pénalité de retard de ${contract.latePenalty.rate} % par ${periodName} est due de plein droit après mise en demeure préalable.`;
  }

  const witnessStr = contract.witness?.enabled && contract.witness.fullName.trim()
    ? `\n- Le Témoin : ${contract.witness.fullName.trim()} (nom et signature)`
    : '';

  const formattedStartDate = new Date(contract.startDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return `CONTRAT DE PRÊT D'ARGENT N° ${contract.contractNumber} (acte sous seing privé)

Entre les soussignés :

1. Le PRÊTEUR : ${contract.lender.fullName.trim()}, demeurant au ${contract.lender.address.trim()}, tél. : ${contract.lender.phone.trim()}.
ET
2. L'EMPRUNTEUR : ${contract.borrower.fullName.trim()}, demeurant au ${contract.borrower.address.trim()}, tél. : ${contract.borrower.phone.trim()}${borrowerIdStr}.

Il a été convenu et arrêté ce qui suit :

Art. 1 Objet : Le Prêteur remet à l'Emprunteur la somme de ${amountDigits} (${amountWords}).

Art. 2 Remise des fonds : Remise effectuée le ${formattedStartDate} par ${deliveryStr}. L'Emprunteur reconnaît expressément avoir reçu ladite somme ce jour et en donne quittance sous réserve d'encaissement.

Art. 3 Remboursement : ${art3Text}

Art. 4 Intérêts : ${art4Text}

Art. 5 Sommes supplémentaires : Toute somme remise ensuite fait l'objet d'un avenant daté et signé, précisant montant et motif, et s'ajoute à la dette aux mêmes conditions générales.

Art. 6 Imputation : Chaque remboursement s'impute d'abord sur les intérêts échus, puis sur le capital principal restant dû.

Art. 7 Retard : ${art7Text}

Art. 8 Preuve : Les parties reconnaissent la pleine valeur juridique de l'écrit et des signatures électroniques recueillies, conformément à l'ordonnance-loi n° 23/010 du 13 mars 2023 portant Code du numérique en République Démocratique du Congo. Le relevé des mouvements annexé fait foi entre les parties sauf preuve contraire.

Art. 9 Litiges : En cas de différend relatif à l'interprétation ou à l'exécution du présent contrat, les parties s'engagent à privilégier un règlement amiable préalable. À défaut d'accord, compétence exclusive est attribuée aux juridictions compétentes de la ville de ${contract.lender.jurisdictionCity || 'Kinshasa'}. Loi applicable : droit congolais.

Art. 10 Exemplaires : Le présent contrat est établi électroniquement et chaque partie reçoit un exemplaire certifié conforme.

Fait à ${contract.lender.city || 'Kinshasa'}, le ${contract.signedAt}.

Signatures :
- Le Prêteur : ${contract.lender.fullName} (${contract.debtType === 'je_dois' ? 'signature électronique apposée' : 'signature électronique enregistrée'})
- L'Emprunteur : ${contract.borrower.fullName} (${contract.debtType === 'je_dois' ? 'signature électronique enregistrée' : 'signature électronique apposée'})${witnessStr}

Annexe : Relevé des mouvements au jour de la signature (Capital initial : ${amountDigits}).`;
}

/**
 * Standard contract builder dispatcher: defaults to v2 for all new contracts.
 */
export function buildContractFullText(
  contract: Omit<Contract, 'contractText' | 'contentDigest'>,
  options?: { shortLegalClausesEnabled?: boolean }
): string {
  if (contract.templateVersion === 'v1') {
    return buildContractFullTextV1(contract);
  }
  return buildContractFullTextV2(contract, options);
}

/**
 * Builds the v2 short 5-line amendment text.
 * "AVENANT N° [n] au contrat N° [numéro]. Le [date], [emprunteur] reçoit de [prêteur] une somme supplémentaire de [montant] [devise]. Motif : [note]. Nouveau total : [total] [devise]. Les autres conditions du contrat ne changent pas."
 */
export function buildAmendmentFullTextV2(params: {
  contract: Contract;
  amendmentNumber: number;
  addedAmount: number;
  reason: string;
  date: string;
  signedAt: string;
  newPrincipalTotal: number;
}): string {
  const { contract, amendmentNumber, addedAmount, reason, date, signedAt, newPrincipalTotal } = params;
  const cur = contract.currency;
  const symbol = cur === 'USD' ? '$' : 'FC';
  const addedDigits = fmtAmt(addedAmount, cur);
  const totalDigits = fmtAmt(newPrincipalTotal, cur);

  const formattedDate = new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const borrowerName = contract.borrower.fullName.trim();
  const lenderName = contract.lender.fullName.trim();

  const witnessStr = contract.witness?.enabled && contract.witness.fullName.trim()
    ? `\n- Le Témoin : ${contract.witness.fullName.trim()}`
    : '';

  return `AVENANT N° ${amendmentNumber} au contrat N° ${contract.contractNumber}. Le ${formattedDate}, ${borrowerName} reçoit de ${lenderName} une somme supplémentaire de ${addedDigits}. Motif : ${reason.trim()}. Nouveau total : ${totalDigits}. Les autres conditions du contrat ne changent pas.

Fait à ${contract.lender.city || 'Kinshasa'}, le ${signedAt}.

Signatures :
- L'Emprunteur : ${borrowerName}
- Le Prêteur : ${lenderName}${witnessStr}`;
}

/**
 * Builds legacy v1 amendment text (for backwards compatibility).
 */
export function buildAmendmentFullTextV1(params: {
  contract: Contract;
  amendmentNumber: number;
  addedAmount: number;
  reason: string;
  date: string;
  signedAt: string;
  newPrincipalTotal: number;
}): string {
  const { contract, amendmentNumber, addedAmount, reason, date, signedAt, newPrincipalTotal } = params;
  const currencySymbol = contract.currency === 'USD' ? '$' : 'FC';
  const addedAmountDigits = `${addedAmount.toLocaleString('fr-FR')} ${currencySymbol}`;
  const addedAmountWords = formatAmountInWords(addedAmount, contract.currency);

  const newTotalDigits = `${newPrincipalTotal.toLocaleString('fr-FR')} ${currencySymbol}`;
  const newTotalWords = formatAmountInWords(newPrincipalTotal, contract.currency);

  const formattedDate = new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const witnessStr = contract.witness?.enabled && contract.witness.fullName.trim()
    ? `\n- Le Témoin : ${contract.witness.fullName.trim()} (nom et signature)`
    : '';

  return `AVENANT N° ${amendmentNumber} AU CONTRAT DE PRÊT D'ARGENT N° ${contract.contractNumber}

Entre les soussignés :
- Le PRÊTEUR : ${contract.lender.fullName}, demeurant au ${contract.lender.address}, tél. : ${contract.lender.phone}.
- L'EMPRUNTEUR : ${contract.borrower.fullName}, demeurant au ${contract.borrower.address}, tél. : ${contract.borrower.phone}.

Exposé et conventions :
Par le présent avenant, le Prêteur consent à remettre à l'Emprunteur une somme supplémentaire de :
${addedAmountDigits} (${addedAmountWords}),
remise le ${formattedDate} pour le motif suivant : "${reason.trim()}".

Nouveau capital principal total prêté :
${newTotalDigits} (${newTotalWords}).

Toutes les autres clauses, engagements, conditions d'intérêts, d'imputation et de juridiction du contrat de prêt initial n° ${contract.contractNumber} demeurent pleinement applicables et inchangés.

Fait à ${contract.lender.city || 'Kinshasa'}, le ${signedAt}.

Signatures :
- Le Prêteur : ${contract.lender.fullName}
- L'Emprunteur : ${contract.borrower.fullName}${witnessStr}`;
}

/**
 * Standard amendment builder dispatcher: defaults to v2 for all new amendments.
 */
export function buildAmendmentFullText(params: {
  contract: Contract;
  amendmentNumber: number;
  addedAmount: number;
  reason: string;
  date: string;
  signedAt: string;
  newPrincipalTotal: number;
  templateVersion?: 'v1' | 'v2';
}): string {
  const version = params.templateVersion || params.contract.templateVersion || 'v2';
  if (version === 'v1') {
    return buildAmendmentFullTextV1(params);
  }
  return buildAmendmentFullTextV2(params);
}
