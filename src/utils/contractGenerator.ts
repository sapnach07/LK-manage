import { Contract, Amendment, DeliveryMethod } from '../types/contract';
import { formatAmountInWords } from './numberToWords';

export function formatDeliveryMethodName(method: DeliveryMethod): string {
  switch (method) {
    case 'especes':
      return 'espèces (cash)';
    case 'mobile_money':
      return 'Mobile Money (M-Pesa / Airtel Money / Orange Money)';
    case 'virement_bancaire':
      return 'virement bancaire';
    default:
      return method;
  }
}

export function formatDeliveryMethodsList(methods: DeliveryMethod[]): string {
  if (!methods || methods.length === 0) {
    return 'espèces (cash)';
  }
  return methods.map(formatDeliveryMethodName).join(', ');
}

export function formatBorrowerIdentityText(contract: Pick<Contract, 'borrower'>): string {
  const id = contract.borrower.identity;
  if (!id || !id.enabled || !id.number.trim()) {
    return '';
  }

  let typeName = 'Pièce d’identité';
  if (id.type === 'carte_electeur') typeName = 'Carte d’électeur';
  else if (id.type === 'passeport') typeName = 'Passeport';
  else if (id.type === 'permis_conduire') typeName = 'Permis de conduire';
  else if (id.type === 'autre') typeName = 'Document officiel';

  return `, titulaire de la ${typeName} n° ${id.number.trim()}`;
}

export function generateContractNumber(existingCount = 0): string {
  const year = new Date().getFullYear();
  const sequence = String(existingCount + 1).padStart(4, '0');
  return `CTR-${year}-${sequence}`;
}

/**
 * Computes the SHA-256 hex digest of a UTF-8 text string using Web Crypto API.
 */
export async function computeSha256Digest(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates the full exact textual model of the loan contract as specified.
 */
export function buildContractFullText(contract: Omit<Contract, 'contractText' | 'contentDigest'>): string {
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
- Le Prêteur : ${contract.lender.fullName} (signature électronique enregistrée)
- L'Emprunteur : ${contract.borrower.fullName} (signature électronique apposée)${witnessStr}

Annexe : Relevé des mouvements au jour de la signature (Capital initial : ${amountDigits}).`;
}

/**
 * Builds the text for an amendment ("Avenant").
 */
export function buildAmendmentFullText(params: {
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
