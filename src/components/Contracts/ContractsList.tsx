import React, { useState } from 'react';
import {
  FileText,
  Lock,
  Share2,
  PlusCircle,
  Search,
  UserCheck,
  ShieldCheck,
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
  debts,
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
      {/* Lender profile banner / shortcut */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">Profil du Prêteur</h3>
            <p className="text-[11px] text-slate-400">
              {lenderConfigured
                ? 'Coordonnées & signature enregistrées'
                : 'Signature non configurée (à définir)'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenLenderProfile}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold border border-slate-700 transition cursor-pointer"
        >
          {lenderConfigured ? 'Modifier' : 'Configurer'}
        </button>
      </div>

      {actionFeedback && (
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium text-center">
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
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-amber-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Tous ({contracts.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('active')}
            className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
              filterStatus === 'active'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Actifs ({contracts.filter((c) => c.status !== 'cancelled').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('cancelled')}
            className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
              filterStatus === 'cancelled'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Annulés ({contracts.filter((c) => c.status === 'cancelled').length})
          </button>
        </div>
      </div>

      {/* Contracts List */}
      {filteredContracts.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 text-center space-y-3">
          <FileText className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white">Aucun contrat trouvé</h4>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Générez un contrat sous seing privé avec valeur probante lors de la saisie d'un prêt d'argent.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenNewDebtWithContract}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-amber-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nouveau prêt avec contrat</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredContracts.map((contract) => {
            const currencySymbol = contract.currency === 'USD' ? '$' : 'FC';
            const amendmentsCount = contract.amendments?.length || 0;

            return (
              <div
                key={contract.id}
                onClick={() => onOpenContractDetail(contract)}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition cursor-pointer space-y-2.5 text-xs shadow-md"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-400 text-xs">
                        {contract.contractNumber}
                      </span>
                      {contract.status === 'cancelled' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold flex items-center gap-1">
                          <Ban className="w-2.5 h-2.5" />
                          Annulé
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          Scellé
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-white mt-1">
                      {contract.borrower.fullName}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Tél. {contract.borrower.phone} • {contract.borrower.address}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-black text-amber-400">
                      {contract.principalAmount.toLocaleString('fr-FR')} {currencySymbol}
                    </span>
                    <p className="text-[10px] text-slate-500">
                      {contract.interestType === 'none'
                        ? 'Sans intérêt'
                        : `${contract.interestRate}% ${
                            contract.interestType === 'percentage_once' ? 'unique' : '/mois'
                          }`}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      Signé le {contract.signedAt.split('à')[0] || contract.signedAt}
                    </span>
                    {amendmentsCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 text-[10px]">
                        {amendmentsCount} avenant{amendmentsCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {onOpenDebt && contract.debtId && (
                      <button
                        type="button"
                        onClick={() => onOpenDebt(contract.debtId)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-[11px] transition cursor-pointer flex items-center gap-1 border border-slate-700"
                        title="Consulter la dette liée"
                      >
                        <ArrowRight className="w-3 h-3 text-emerald-400" />
                        <span>Fiche dette</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleShareQuick(e, contract)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                      title="Partager ou télécharger le PDF"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>

                    {contract.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenAmendment(contract);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold text-[11px] transition cursor-pointer flex items-center gap-1"
                      >
                        <PlusCircle className="w-3 h-3" />
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
