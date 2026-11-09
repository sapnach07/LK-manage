import React, { useState } from 'react';
import {
  FileText,
  Lock,
  Share2,
  Plus,
  Search,
  UserCheck,
  Ban,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Contract } from '../../types/contract';
import { Debt } from '../../types/debt';
import { generateContractPdf, shareOrDownloadContractPdf } from '../../utils/pdfGenerator';
import { isLenderProfileConfigured } from '../../services/lenderProfile';

interface ContractsListProps {
  contracts: Contract[];
  debts: Debt[];
  onOpenContractDetail: (contract: Contract) => void;
  onOpenAmendment: (contract: Contract) => void;
  onOpenLenderProfile: () => void;
  onOpenNewDebtWithContract: () => void;
  onOpenDebt?: (debtId: string) => void;
}

export const ContractsList: React.FC<ContractsListProps> = ({
  contracts,
  debts: _debts,
  onOpenContractDetail,
  onOpenAmendment,
  onOpenLenderProfile,
  onOpenNewDebtWithContract,
  onOpenDebt,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'cancelled'>('all');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const lenderConfigured = isLenderProfileConfigured();

  const filteredContracts = contracts.filter((c) => {
    if (filterStatus === 'active' && c.status === 'cancelled') return false;
    if (filterStatus === 'cancelled' && c.status !== 'cancelled') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.borrower.fullName.toLowerCase().includes(q);
      const matchNumber = c.contractNumber.toLowerCase().includes(q);
      const matchPhone = c.borrower.phone.toLowerCase().includes(q);
      return matchName || matchNumber || matchPhone;
    }
    return true;
  });

  const handleShareQuick = async (e: React.MouseEvent, contract: Contract) => {
    e.stopPropagation();
    const doc = generateContractPdf(contract);
    const filename = `contrat-${contract.contractNumber}.pdf`;
    const title = `Contrat de prêt ${contract.contractNumber} - ${contract.borrower.fullName}`;
    const res = await shareOrDownloadContractPdf(doc, filename, title);
    setActionFeedback(res === 'shared' ? 'Contrat partagé avec succès.' : 'PDF téléchargé.');
    setTimeout(() => setActionFeedback(null), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Lender profile banner */}
      <div className="p-3.5 rounded-[8px] bg-[#1C232D] border border-[#2A3340] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[8px] bg-[#151A22] border border-[#2A3340] flex items-center justify-center text-[#C8A96A]">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#ECE9E2]">Profil du prêteur</h3>
            <p className="text-xs text-[#98A2B0]">
              {lenderConfigured
                ? 'Coordonnées et signature enregistrées'
                : 'Signature non configurée'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenLenderProfile}
          className="min-h-[44px] px-3.5 rounded-[8px] bg-[#151A22] hover:bg-[#2A3340] text-[#C8A96A] text-xs font-medium border border-[#2A3340] transition cursor-pointer"
        >
          {lenderConfigured ? 'Modifier' : 'Configurer'}
        </button>
      </div>

      {actionFeedback && (
        <div className="p-3 rounded-[8px] bg-[#1C232D] border border-[#5FB48C] text-[#5FB48C] text-xs font-medium text-center">
          {actionFeedback}
        </div>
      )}

      {/* Search and Filters */}
      <div className="space-y-2">
        <div className="relative">
          <input
            type="text"
            placeholder="Rechercher par n° de contrat, emprunteur, tél..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-[44px] pl-10 pr-3 rounded-[8px] bg-[#1C232D] border border-[#2A3340] text-[#ECE9E2] placeholder-[#98A2B0] text-sm focus:outline-none focus:border-[#C8A96A]"
          />
          <Search className="w-4 h-4 text-[#98A2B0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`min-h-[44px] px-3.5 rounded-[8px] font-medium transition cursor-pointer border ${
              filterStatus === 'all'
                ? 'bg-[#C8A96A] text-[#151A22] border-[#C8A96A] font-semibold'
                : 'bg-[#1C232D] text-[#98A2B0] hover:text-[#ECE9E2] border-[#2A3340]'
            }`}
          >
            Tous ({contracts.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('active')}
            className={`min-h-[44px] px-3.5 rounded-[8px] font-medium transition cursor-pointer border ${
              filterStatus === 'active'
                ? 'bg-[#C8A96A] text-[#151A22] border-[#C8A96A] font-semibold'
                : 'bg-[#1C232D] text-[#98A2B0] hover:text-[#ECE9E2] border-[#2A3340]'
            }`}
          >
            Actifs ({contracts.filter((c) => c.status !== 'cancelled').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('cancelled')}
            className={`min-h-[44px] px-3.5 rounded-[8px] font-medium transition cursor-pointer border ${
              filterStatus === 'cancelled'
                ? 'bg-[#C8A96A] text-[#151A22] border-[#C8A96A] font-semibold'
                : 'bg-[#1C232D] text-[#98A2B0] hover:text-[#ECE9E2] border-[#2A3340]'
            }`}
          >
            Annulés ({contracts.filter((c) => c.status === 'cancelled').length})
          </button>
        </div>
      </div>

      {/* Contracts List - Ledger Rows */}
      {filteredContracts.length === 0 ? (
        <div className="p-8 rounded-[8px] bg-[#1C232D] border border-[#2A3340] text-center space-y-3">
          <FileText className="w-10 h-10 text-[#98A2B0] mx-auto" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-[#ECE9E2]">Aucun contrat trouvé</h4>
            <p className="text-xs text-[#98A2B0] max-w-xs mx-auto">
              Générez un contrat sous seing privé avec valeur probante lors de la saisie d'un prêt.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenNewDebtWithContract}
            className="min-h-[44px] px-4 rounded-[8px] bg-[#C8A96A] hover:bg-[#d6b777] text-[#151A22] font-semibold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau prêt avec contrat</span>
          </button>
        </div>
      ) : (
        <div className="rounded-[8px] bg-[#1C232D] border border-[#2A3340] overflow-hidden divide-y divide-[#2A3340]">
          {filteredContracts.map((contract) => {
            const currencyLabel = contract.currency === 'USD' ? 'USD' : 'FC';
            const amendmentsCount = contract.amendments?.length || 0;
            const isCancelled = contract.status === 'cancelled';

            return (
              <div
                key={contract.id}
                onClick={() => onOpenContractDetail(contract)}
                className="p-3.5 hover:bg-[#151A22]/50 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                {/* Left side: Borrower name, contract number, status */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-semibold text-[#ECE9E2] truncate">
                      {contract.borrower.fullName}
                    </span>
                    <span className="text-xs text-[#98A2B0] font-mono">
                      N° {contract.contractNumber}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px]">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isCancelled ? 'bg-[#E5604D]' : 'bg-[#5FB48C]'
                        }`}
                      />
                      <span className={isCancelled ? 'text-[#E5604D]' : 'text-[#5FB48C]'}>
                        {isCancelled ? 'Annulé' : 'Scellé'}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[#98A2B0] mt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Signé le {contract.signedAt.split('à')[0] || contract.signedAt}
                    </span>
                    <span>Tél. {contract.borrower.phone}</span>
                    {amendmentsCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-[4px] bg-[#151A22] border border-[#2A3340] text-[#ECE9E2] text-[11px]">
                        {amendmentsCount} avenant{amendmentsCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side: Amount and actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-base font-semibold text-[#ECE9E2] tabular-nums block">
                      {contract.principalAmount.toLocaleString('fr-FR')} {currencyLabel}
                    </span>
                    <span className="text-xs text-[#98A2B0]">
                      {contract.interestType === 'none'
                        ? 'Sans intérêt'
                        : `${contract.interestRate}% ${
                            contract.interestType === 'percentage_once' ? 'unique' : '/mois'
                          }`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {onOpenDebt && contract.debtId && (
                      <button
                        type="button"
                        onClick={() => onOpenDebt(contract.debtId)}
                        className="min-h-[44px] min-w-[44px] px-2.5 rounded-[8px] bg-[#151A22] hover:bg-[#2A3340] text-[#ECE9E2] font-medium text-xs transition cursor-pointer flex items-center justify-center gap-1 border border-[#2A3340]"
                        title="Consulter la dette liée"
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-[#5FB48C]" />
                        <span className="hidden sm:inline">Dette</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleShareQuick(e, contract)}
                      className="min-h-[44px] min-w-[44px] rounded-[8px] bg-[#151A22] hover:bg-[#2A3340] text-[#ECE9E2] border border-[#2A3340] transition cursor-pointer flex items-center justify-center"
                      title="Partager ou télécharger le PDF"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>

                    {!isCancelled && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenAmendment(contract);
                        }}
                        className="min-h-[44px] px-3 rounded-[8px] bg-[#151A22] hover:bg-[#2A3340] text-[#C8A96A] border border-[#2A3340] font-medium text-xs transition cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Avenant</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
