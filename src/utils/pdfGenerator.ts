import { jsPDF } from 'jspdf';
import { Contract, Amendment } from '../types/contract';

/**
 * Generates an official, sober loan contract PDF in Times New Roman (100% offline).
 * Includes unique contract number, signature timestamp, SHA-256 fingerprint in footer,
 * and embedded electronic signatures.
 */
export function generateContractPdf(contract: Contract): jsPDF {
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

  // Set font to Times New Roman
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

  // Thin separator line
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Articles title
  doc.setFont('times', 'bold');
  doc.setFontSize(10.5);
  doc.text('IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT :', margin, y);
  y += 6;

  // Read lines from the generated contract text
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

  // Check page overflow for signatures
  if (y > pageHeight - 55) {
    doc.addPage();
    y = margin;
  }

  // Location and Date
  y += 2;
  doc.setFont('times', 'italic');
  doc.setFontSize(9.5);
  doc.text(`Fait à ${contract.lender.city || 'Kinshasa'}, le ${contract.signedAt}.`, margin, y);
  y += 7;

  // Signatures Section
  const signatureBoxWidth = (contentWidth - 6) / (contract.witness?.enabled ? 3 : 2);
  const signatureBoxHeight = 28;

  // 1. Lender
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

  // 2. Borrower
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

  // 3. Witness (if enabled)
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

  // Annexe
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

  // Print Footer with SHA-256 fingerprint on every page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('times', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(90, 90, 90);

    // Footer divider line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.text(
      `Empreinte numérique SHA-256 : ${contract.contentDigest}`,
      margin,
      pageHeight - 8
    );
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
 * Generates an official PDF for a contract amendment ("Avenant").
 */
export function generateAmendmentPdf(contract: Contract, amendment: Amendment): jsPDF {
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

  // Header Box
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

  // Amendment Body
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.text('EXPOSÉ ET CONVENTIONS :', margin, y);
  y += 5;

  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  const bodyTextLines = doc.splitTextToSize(amendment.amendmentText, contentWidth);
  doc.text(bodyTextLines, margin, y);
  y += bodyTextLines.length * 4.5 + 8;

  // Signatures
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

  // Footer on page
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
      doc.addImage(signatureDataUrl, 'PNG', x + 4, y + 10, width - 8, height - 12);
    } catch (e) {
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
        // User cancelled share dialog, return shared to avoid force download
        return 'shared';
      }
      // Fallback to download below
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
