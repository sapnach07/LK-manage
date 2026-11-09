import React, { useState } from 'react';
import { X, Calendar, Clock, FileText, Check, Repeat, AlertCircle } from 'lucide-react';
import { PlanningTask, TaskRepetition } from '../../types/planning';

interface TaskFormModalProps {
  initialTask?: PlanningTask | null;
  onSave: (taskData: Omit<PlanningTask, 'id' | 'createdAt' | 'updatedAt' | 'completed'> & { id?: string }) => Promise<void>;
  onClose: () => void;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({ initialTask, onSave, onClose }) => {
  const isEditing = !!initialTask;

  const [title, setTitle] = useState(initialTask?.title || '');
  const [date, setDate] = useState(initialTask?.date || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(initialTask?.time || '');
  const [note, setNote] = useState(initialTask?.note || '');
  const [repetition, setRepetition] = useState<TaskRepetition>(initialTask?.repetition || 'none');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Veuillez renseigner un titre pour cette tâche ou rendez-vous.');
      return;
    }

    if (!date) {
      setError('Veuillez renseigner une date.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        ...(initialTask?.id ? { id: initialTask.id } : {}),
        title: title.trim(),
        date,
        time: time.trim() || undefined,
        note: note.trim() || undefined,
        repetition,
      });
      onClose();
    } catch (err: unknown) {
      setError((err as Error)?.message || "Erreur lors de l'enregistrement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-[16px] sm:rounded-[16px] bg-[#1C232D] border border-[#2A3340] p-4 sm:p-5 text-[#ECE9E2] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2A3340]">
          <div>
            <h2 className="text-base font-semibold text-[#ECE9E2]">
              {isEditing ? 'Modifier la tâche' : 'Nouvelle tâche ou rendez-vous'}
            </h2>
            <p className="text-xs text-[#98A2B0]">Rappels personnels et échéances</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-[8px] text-[#98A2B0] hover:text-[#ECE9E2] hover:bg-[#151A22] transition flex items-center justify-center cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto py-4 space-y-4 flex-1 pr-1 text-xs">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-[8px] bg-[#151A22] border border-[#E5604D] text-[#E5604D]">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#E5604D]" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#ECE9E2]">
              Titre / Objet <span className="text-[#E5604D]">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Rdv banque, appel emprunteur..."
              className="w-full min-h-[44px] px-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#ECE9E2] placeholder-[#98A2B0] focus:outline-none focus:border-[#C8A96A] text-sm"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#ECE9E2]">
                Date <span className="text-[#E5604D]">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-[#98A2B0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full min-h-[44px] pl-9 pr-2 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#ECE9E2] focus:outline-none focus:border-[#C8A96A] text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#ECE9E2]">
                Heure (optionnelle)
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-[#98A2B0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full min-h-[44px] pl-9 pr-2 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#ECE9E2] focus:outline-none focus:border-[#C8A96A] text-xs"
                />
              </div>
            </div>
          </div>

          {/* Repetition */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#ECE9E2] flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5 text-[#C8A96A]" />
              Répétition
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRepetition('none')}
                className={`min-h-[44px] rounded-[8px] border transition cursor-pointer text-center text-xs ${
                  repetition === 'none'
                    ? 'bg-[#C8A96A] text-[#151A22] border-[#C8A96A] font-semibold'
                    : 'bg-[#151A22] text-[#98A2B0] hover:text-[#ECE9E2] border-[#2A3340]'
                }`}
              >
                Aucune
              </button>
              <button
                type="button"
                onClick={() => setRepetition('weekly')}
                className={`min-h-[44px] rounded-[8px] border transition cursor-pointer text-center text-xs ${
                  repetition === 'weekly'
                    ? 'bg-[#C8A96A] text-[#151A22] border-[#C8A96A] font-semibold'
                    : 'bg-[#151A22] text-[#98A2B0] hover:text-[#ECE9E2] border-[#2A3340]'
                }`}
              >
                Chaque semaine
              </button>
              <button
                type="button"
                onClick={() => setRepetition('monthly')}
                className={`min-h-[44px] rounded-[8px] border transition cursor-pointer text-center text-xs ${
                  repetition === 'monthly'
                    ? 'bg-[#C8A96A] text-[#151A22] border-[#C8A96A] font-semibold'
                    : 'bg-[#151A22] text-[#98A2B0] hover:text-[#ECE9E2] border-[#2A3340]'
                }`}
              >
                Chaque mois
              </button>
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#ECE9E2]">
              Note libre (optionnelle)
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-[#98A2B0] absolute left-3 top-3" />
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Détails, documents à apporter, instructions..."
                className="w-full pl-9 pr-3 py-2 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#ECE9E2] placeholder-[#98A2B0] focus:outline-none focus:border-[#C8A96A] resize-none text-xs"
              />
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-[#2A3340] flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-[8px] bg-[#151A22] hover:bg-[#2A3340] text-xs font-medium text-[#ECE9E2] border border-[#2A3340] transition cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 min-h-[44px] rounded-[8px] bg-[#C8A96A] hover:bg-[#d6b777] text-xs font-semibold text-[#151A22] flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{isSubmitting ? 'Enregistrement...' : isEditing ? 'Mettre à jour la tâche' : 'Enregistrer la tâche'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
