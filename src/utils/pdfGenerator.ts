import { jsPDF } from 'jspdf';
import { Contract, Amendment } from '../types/contract';

/**
 * Draws a clean signature box with proportional image rendering.
 */
function drawSignatureBox(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  role: string,
  name: string,
  signatureDataUrl?: string
) {
  doc.setDrawColor(180, 180, 180);
  doc.rect(x, y, width, height);

  doc.setFont('times', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  doc.text(role, x + 3, y + 5);

  doc.setFont('times', 'normal');
  doc.setFontSize(7.5);
  doc.text(name, x + 3, y + 9);

  if (signatureDataUrl && signatureDataUrl.startsWith('data:image')) {
    try {
      const imgProps = doc.getImageProperties(signatureDataUrl);
      const maxWidth = width - 8;
      const maxHeight = height - 12;
      const imgRatio = imgProps.width / imgProps.height;
      const boxRatio = maxWidth / maxHeight;

      let renderWidth = maxWidth;
      let renderHeight = maxHeight;

      if (imgRatio > boxRatio) {
        renderWidth = maxWidth;
        renderHeight = maxWidth / imgRatio;
      } else {
        renderHeight = maxHeight;
        renderWidth = maxHeight * imgRatio;
      }

      const offsetX = x + 4 + (maxWidth - renderWidth) / 2;
      const offsetY = y + 10 + (maxHeight - renderHeight) / 2;

      doc.addImage(signatureDataUrl, 'PNG', offsetX, offsetY, renderWidth, renderHeight);
    } catch {
      doc.text('(Signature électronique apposée)', x + 3, y + 16);
    }
  } else {
    doc.text('(Signature électronique)', x + 3, y + 16);
  }
}

function extractArticleText(fullText: string, articlePrefix: string): string {
  const startIndex = fullText.indexOf(articlePrefix);
  if (startIndex === -1) return '';

  const colonIndex = fullText.indexOf(':', startIndex);
  if (colonIndex === -1) return '';

  const nextArticleIndex = fullText.indexOf('Art.', colonIndex + 1);
  const endIndex = nextArticleIndex !== -1 ? nextArticleIndex : fullText.indexOf('Fait à', colonIndex);

  const raw = endIndex !== -1 ? fullText.substring(colonIndex + 1, endIndex) : fullText.substring(colonIndex + 1);
  return raw.trim().replace(/\n+/g, ' ');
}

/**
 * Generates legacy v1 PDF with Articles 1 to 10 and Annexe.
 */
export function generateContractPdfV1(contract: Contract): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  doc.setFont('times', 'bold');
  doc.setFontSize(14);

  // Top Header Box
  doc.setDrawColor(50, 50, 50);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, 20);

  doc.text(`CONTRAT DE PRÊT D'ARGENT N° ${contract.contractNumber}`, pageWidth / 2, y + 8, {
    align: 'center',
  });
  doc.setFont('times', 'italic');
  doc.setFontSize(10);
  doc.text('(Acte sous seing privé valant titre de créance)', pageWidth / 2, y + 14, {
    align: 'center',
  });

  y += 26;

  // Identification Box
  doc.setFont('times', 'bold');
  doc.setFontSize(10.5);
  doc.text('ENTRE LES PARTIES SOUSSIGNÉES :', margin, y);
  y += 5;

  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);

  const lenderLines = doc.splitTextToSize(
    `1. LE PRÊTEUR : ${contract.lender.fullName}, demeurant au ${contract.lender.address}, tél. : ${contract.lender.phone}.`,
    contentWidth
  );
  doc.text(lenderLines, margin, y);
  y += lenderLines.length * 4.5 + 2;

  let borrowerIdStr = '';
  if (contract.borrower.identity?.enabled && contract.borrower.identity.number.trim()) {
    borrowerIdStr = ` (${contract.borrower.identity.type.toUpperCase()} N° ${contract.borrower.identity.number.trim()})`;
  }

  const borrowerLines = doc.splitTextToSize(
    `2. L'EMPRUNTEUR : ${contract.borrower.fullName}, demeurant au ${contract.borrower.address}, tél. : ${contract.borrower.phone}${borrowerIdStr}.`,
    contentWidth
  );
  doc.text(borrowerLines, margin, y);
  y += borrowerLines.length * 4.5 + 4;

  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFont('times', 'bold');
  doc.setFontSize(10.5);
  doc.text('IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT :', margin, y);
  y += 6;

  const articles = [
    { title: 'Art. 1 - Objet', text: extractArticleText(contract.contractText, 'Art. 1') },
    { title: 'Art. 2 - Remise des fonds', text: extractArticleText(contract.contractText, 'Art. 2') },
    { title: 'Art. 3 - Remboursement', text: extractArticleText(contract.contractText, 'Art. 3') },
    { title: 'Art. 4 - Intérêts', text: extractArticleText(contract.contractText, 'Art. 4') },
    { title: 'Art. 5 - Sommes supplémentaires', text: extractArticleText(contract.contractText, 'Art. 5') },
    { title: 'Art. 6 - Imputation', text: extractArticleText(contract.contractText, 'Art. 6') },
    { title: 'Art. 7 - Retard', text: extractArticleText(contract.contractText, 'Art. 7') },
    { title: 'Art. 8 - Preuve et Code du numérique', text: extractArticleText(contract.contractText, 'Art. 8') },
    { title: 'Art. 9 - Litiges et droit applicable', text: extractArticleText(contract.contractText, 'Art. 9') },
    { title: 'Art. 10 - Exemplaires', text: extractArticleText(contract.contractText, 'Art. 10') },
  ];

  for (const art of articles) {
    if (y > pageHeight - 35) {
      doc.addPage();
      y = margin;
    }

    doc.setFont('times', 'bold');
    doc.setFontSize(9.5);
    doc.text(art.title, margin, y);
    y += 4.5;

    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    const bodyLines = doc.splitTextToSize(art.text, contentWidth);
    doc.text(bodyLines, margin, y);
    y += bodyLines.length * 4.2 + 3.5;
  }

  if (y > pageHeight - 55) {
    doc.addPage();
    y = margin;
  }

  y += 2;
  doc.setFont('times', 'italic');
  doc.setFontSize(9);
  doc.text(`Fait à ${contract.lender.city || 'Kinshasa'}, le ${contract.signedAt}.`, margin, y);

  if (contract.readCompletedAt) {
    y += 4.5;
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Preuve de lecture : Lecture intégrale terminée le ${contract.readCompletedAt}.`, margin, y);
    doc.setTextColor(0, 0, 0);
  }

  y += 6;

  const signatureBoxWidth = (contentWidth - 6) / (contract.witness?.enabled ? 3 : 2);
  const signatureBoxHeight = 28;

  drawSignatureBox(
    doc,
    margin,
    y,
    signatureBoxWidth,
    signatureBoxHeight,
    'LE PRÊTEUR',
    contract.lender.fullName,
    contract.lenderSignature
  );

  drawSignatureBox(
    doc,
    margin + signatureBoxWidth + 6,
    y,
    signatureBoxWidth,
    signatureBoxHeight,
    "L'EMPRUNTEUR",
    contract.borrower.fullName,
    contract.borrowerSignature
  );

  if (contract.witness?.enabled && contract.witness.fullName.trim()) {
    drawSignatureBox(
      doc,
      margin + (signatureBoxWidth + 3) * 2,
      y,
      signatureBoxWidth,
      signatureBoxHeight,
      'LE TÉMOIN',
      contract.witness.fullName,
      contract.witnessSignature
    );
  }

  y += signatureBoxHeight + 6;

  if (y > pageHeight - 25) {
    doc.addPage();
    y = margin;
  }
  doc.setFont('times', 'bold');
  doc.setFontSize(8.5);
  doc.text('ANNEXE : RELEVÉ DES MOUVEMENTS AU JOUR DE LA SIGNATURE', margin, y);
  y += 4;
  doc.setFont('times', 'normal');
  doc.setFontSize(8);
  const currencySymbol = contract.currency === 'USD' ? '$' : 'FC';
  doc.text(
    `Capital initial versé : ${contract.principalAmount.toLocaleString('fr-FR')} ${currencySymbol} • Solde restant dû : ${contract.principalAmount.toLocaleString('fr-FR')} ${currencySymbol}`,
    margin,
    y
  );

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('times', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(90, 90, 90);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.text(`Empreinte numérique SHA-256 : ${contract.contentDigest}`, margin, pageHeight - 8);
    doc.text(
      `Contrat ${contract.contractNumber} • Signé le ${contract.signedAt} • Page ${p}/${totalPages}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: 'right' }
    );
  }

  return doc;
}

/**
 * Generates the v2 short one-page PDF ("RECONNAISSANCE DE DETTE N° [numéro]").
 * Displays the exact v2 text without "Art. 1 à Art. 10", without Annexe.
 * Fits cleanly on one page with header, clean paragraphs, signatures, and SHA-256 footer.
 */
export function generateContractPdfV2(contract: Contract): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Title Box
  doc.setDrawColor(50, 50, 50);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, 16);

  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text(`RECONNAISSANCE DE DETTE N° ${contract.contractNumber}`, pageWidth / 2, y + 7, {
    align: 'center',
  });

  doc.setFont('times', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text('(Acte sous seing privé valant engagement de remboursement)', pageWidth / 2, y + 12, {
    align: 'center',
  });

  y += 22;

  // Extract clean paragraphs from contractText, excluding the title and Signatures footer lines
  const lines = contract.contractText.split('\n');
  const paragraphs: string[] = [];
  let currentPara: string[] = [];
  let inSignatures = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentPara.length > 0) {
        paragraphs.push(currentPara.join(' '));
        currentPara = [];
      }
      continue;
    }
    // Skip title line since we rendered the nice box
    if (trimmed.startsWith('RECONNAISSANCE DE DETTE')) continue;

    // Detect signatures section
    if (trimmed.startsWith('Signatures :') || trimmed.startsWith('Signatures:')) {
      inSignatures = true;
      if (currentPara.length > 0) {
        paragraphs.push(currentPara.join(' '));
        currentPara = [];
      }
      break;
    }

    if (!inSignatures) {
      currentPara.push(trimmed);
    }
  }

  if (currentPara.length > 0) {
    paragraphs.push(currentPara.join(' '));
  }

  // Print paragraphs with balanced spacing
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);

  for (const para of paragraphs) {
    if (para.startsWith('REMBOURSEMENT :') || para.startsWith('INTÉRÊT :') || para.startsWith('EN CAS DE RETARD :') || para.startsWith('AUTRES SOMMES :') || para.startsWith('REMBOURSEMENTS :') || para.startsWith('PREUVE :')) {
      // Bold label prefix
      const colonIdx = para.indexOf(':');
      const label = para.substring(0, colonIdx + 1);
      const rest = para.substring(colonIdx + 1);

      doc.setFont('times', 'bold');
      const labelWidth = doc.getTextWidth(label + ' ');
      doc.text(label, margin, y);

      doc.setFont('times', 'normal');
      const splitLines = doc.splitTextToSize(rest.trim(), contentWidth - labelWidth);
      if (splitLines.length > 0) {
        doc.text(splitLines[0], margin + labelWidth, y);
        if (splitLines.length > 1) {
          const remainingLines = splitLines.slice(1);
          doc.text(remainingLines, margin, y + 4.8);
          y += remainingLines.length * 4.8;
        }
      }
      y += 6.5;
    } else if (para.startsWith('Fait à')) {
      y += 1.5;
      doc.setFont('times', 'italic');
      doc.setFontSize(9.5);
      doc.text(para, margin, y);
      y += 6.5;
      doc.setFont('times', 'normal');
      doc.setFontSize(10);
    } else {
      // Regular paragraph
      const textLines = doc.splitTextToSize(para, contentWidth);
      doc.text(textLines, margin, y);
      y += textLines.length * 4.8 + 2.5;
    }
  }

  // Reading completion proof timestamp
  if (contract.readCompletedAt) {
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Preuve de lecture : Lecture intégrale terminée le ${contract.readCompletedAt}.`, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 5.5;
  }

  y += 2;

  // Signatures section (compact)
  const isWitness = !!(contract.witness?.enabled && contract.witness.fullName.trim());
  const boxWidth = (contentWidth - 6) / (isWitness ? 3 : 2);
  const boxHeight = 26;

  // Emprunteur, Prêteur, Témoin
  drawSignatureBox(
    doc,
    margin,
    y,
    boxWidth,
    boxHeight,
    "L'EMPRUNTEUR",
    contract.borrower.fullName,
    contract.borrowerSignature
  );

  drawSignatureBox(
    doc,
    margin + boxWidth + 6,
    y,
    boxWidth,
    boxHeight,
    'LE PRÊTEUR',
    contract.lender.fullName,
    contract.lenderSignature
  );

  if (isWitness && contract.witness?.fullName) {
    drawSignatureBox(
      doc,
      margin + (boxWidth + 3) * 2,
      y,
      boxWidth,
      boxHeight,
      'LE TÉMOIN',
      contract.witness.fullName,
      contract.witnessSignature
    );
  }

  // Footer: contract number, timestamp and SHA-256 fingerprint on single page
  doc.setFont('times', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
  doc.text(`Empreinte numérique SHA-256 : ${contract.contentDigest}`, margin, pageHeight - 8);
  doc.text(
    `Reconnaissance de dette ${contract.contractNumber} • Signée le ${contract.signedAt} • Page 1/1`,
    pageWidth - margin,
    pageHeight - 8,
    { align: 'right' }
  );

  return doc;
}

/**
 * Contract PDF dispatcher: uses v2 format for new contracts, v1 for legacy contracts.
 */
export function generateContractPdf(contract: Contract): jsPDF {
  if (contract.templateVersion === 'v1') {
    return generateContractPdfV1(contract);
  }
  return generateContractPdfV2(contract);
}

/**
 * Generates legacy v1 PDF for an amendment.
 */
export function generateAmendmentPdfV1(contract: Contract, amendment: Amendment): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  doc.setFont('times', 'bold');
  doc.setFontSize(13);

  doc.setDrawColor(50, 50, 50);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, 22);

  doc.text(`AVENANT N° ${amendment.amendmentNumber}`, pageWidth / 2, y + 8, { align: 'center' });
  doc.setFont('times', 'italic');
  doc.setFontSize(10);
  doc.text(`Au Contrat de Prêt d'Argent N° ${contract.contractNumber}`, pageWidth / 2, y + 14, { align: 'center' });
  doc.setFontSize(8.5);
  doc.text('(Ajout de fonds avec valeur probante selon le Code du numérique)', pageWidth / 2, y + 19, { align: 'center' });

  y += 28;

  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.text('ENTRE LES SOUSSIGNÉS :', margin, y);
  y += 5;

  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.text(`- Le Prêteur : ${contract.lender.fullName}, demeurant au ${contract.lender.address}, tél. : ${contract.lender.phone}`, margin, y);
  y += 5;
  doc.text(`- L'Emprunteur : ${contract.borrower.fullName}, demeurant au ${contract.borrower.address}, tél. : ${contract.borrower.phone}`, margin, y);
  y += 8;

  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.text('EXPOSÉ ET CONVENTIONS :', margin, y);
  y += 5;

  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  const bodyTextLines = doc.splitTextToSize(amendment.amendmentText, contentWidth);
  doc.text(bodyTextLines, margin, y);
  y += bodyTextLines.length * 4.5 + 4;

  if (amendment.readCompletedAt) {
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Preuve de lecture : Lecture intégrale terminée le ${amendment.readCompletedAt}.`, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 5.5;
  } else {
    y += 4;
  }

  const signatureBoxWidth = (contentWidth - 6) / (amendment.witnessSignature ? 3 : 2);
  const signatureBoxHeight = 28;

  drawSignatureBox(
    doc,
    margin,
    y,
    signatureBoxWidth,
    signatureBoxHeight,
    'LE PRÊTEUR',
    contract.lender.fullName,
    amendment.lenderSignature
  );

  drawSignatureBox(
    doc,
    margin + signatureBoxWidth + 6,
    y,
    signatureBoxWidth,
    signatureBoxHeight,
    "L'EMPRUNTEUR",
    contract.borrower.fullName,
    amendment.borrowerSignature
  );

  if (amendment.witnessSignature && contract.witness?.fullName) {
    drawSignatureBox(
      doc,
      margin + (signatureBoxWidth + 3) * 2,
      y,
      signatureBoxWidth,
      signatureBoxHeight,
      'LE TÉMOIN',
      contract.witness.fullName,
      amendment.witnessSignature
    );
  }

  doc.setFont('times', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
  doc.text(`Empreinte numérique SHA-256 : ${amendment.contentDigest}`, margin, pageHeight - 8);
  doc.text(
    `Avenant n°${amendment.amendmentNumber} au contrat ${contract.contractNumber} • Signé le ${amendment.signedAt}`,
    pageWidth - margin,
    pageHeight - 8,
    { align: 'right' }
  );

  return doc;
}

/**
 * Generates the v2 short 5-line amendment PDF.
 */
export function generateAmendmentPdfV2(contract: Contract, amendment: Amendment): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Header Box
  doc.setDrawColor(50, 50, 50);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, 16);

  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.text(`AVENANT N° ${amendment.amendmentNumber}`, pageWidth / 2, y + 7, { align: 'center' });
  doc.setFont('times', 'italic');
  doc.setFontSize(9);
  doc.text(`Au contrat de prêt / reconnaissance de dette N° ${contract.contractNumber}`, pageWidth / 2, y + 12, {
    align: 'center',
  });

  y += 24;

  // Extract body lines
  const lines = amendment.amendmentText.split('\n');
  const bodyParagraphs: string[] = [];
  let currentPara: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentPara.length > 0) {
        bodyParagraphs.push(currentPara.join(' '));
        currentPara = [];
      }
      continue;
    }
    if (trimmed.startsWith('Signatures :') || trimmed.startsWith('Signatures:')) {
      if (currentPara.length > 0) {
        bodyParagraphs.push(currentPara.join(' '));
        currentPara = [];
      }
      break;
    }
    currentPara.push(trimmed);
  }
  if (currentPara.length > 0) {
    bodyParagraphs.push(currentPara.join(' '));
  }

  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(20, 20, 20);

  for (const p of bodyParagraphs) {
    if (p.startsWith('Fait à')) {
      y += 2;
      doc.setFont('times', 'italic');
      doc.setFontSize(9.5);
      doc.text(p, margin, y);
      y += 7;
      doc.setFont('times', 'normal');
      doc.setFontSize(10.5);
    } else {
      const splitLines = doc.splitTextToSize(p, contentWidth);
      doc.text(splitLines, margin, y);
      y += splitLines.length * 5 + 4;
    }
  }

  if (amendment.readCompletedAt) {
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Preuve de lecture : Lecture intégrale terminée le ${amendment.readCompletedAt}.`, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 6;
  }

  y += 4;

  // Signatures
  const isWitness = !!(amendment.witnessSignature && contract.witness?.fullName);
  const signatureBoxWidth = (contentWidth - 6) / (isWitness ? 3 : 2);
  const signatureBoxHeight = 26;

  drawSignatureBox(
    doc,
    margin,
    y,
    signatureBoxWidth,
    signatureBoxHeight,
    "L'EMPRUNTEUR",
    contract.borrower.fullName,
    amendment.borrowerSignature
  );

  drawSignatureBox(
    doc,
    margin + signatureBoxWidth + 6,
    y,
    signatureBoxWidth,
    signatureBoxHeight,
    'LE PRÊTEUR',
    contract.lender.fullName,
    amendment.lenderSignature
  );

  if (isWitness && contract.witness?.fullName) {
    drawSignatureBox(
      doc,
      margin + (signatureBoxWidth + 3) * 2,
      y,
      signatureBoxWidth,
      signatureBoxHeight,
      'LE TÉMOIN',
      contract.witness.fullName,
      amendment.witnessSignature
    );
  }

  // Footer on page
  doc.setFont('times', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
  doc.text(`Empreinte numérique SHA-256 : ${amendment.contentDigest}`, margin, pageHeight - 8);
  doc.text(
    `Avenant n°${amendment.amendmentNumber} au contrat ${contract.contractNumber} • Signé le ${amendment.signedAt} • Page 1/1`,
    pageWidth - margin,
    pageHeight - 8,
    { align: 'right' }
  );

  return doc;
}

/**
 * Amendment PDF dispatcher.
 */
export function generateAmendmentPdf(contract: Contract, amendment: Amendment): jsPDF {
  const version = amendment.templateVersion || contract.templateVersion || 'v2';
  if (version === 'v1') {
    return generateAmendmentPdfV1(contract, amendment);
  }
  return generateAmendmentPdfV2(contract, amendment);
}

/**
 * Native phone sharing of the generated PDF using navigator.share with files array.
 * Falls back to browser file download if sharing is unavailable or rejected.
 */
export async function shareOrDownloadContractPdf(doc: jsPDF, filename: string, title: string): Promise<'shared' | 'downloaded'> {
  const blob = doc.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        title,
        text: `${title} (Fichier PDF certifié)`,
        files: [file],
      });
      return 'shared';
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        return 'shared';
      }
    }
  }

  // Fallback download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
