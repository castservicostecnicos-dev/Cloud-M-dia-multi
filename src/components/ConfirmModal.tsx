import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title = 'Confirmação',
  message,
  confirmText = 'Excluir',
  cancelText = 'Cancelar',
  isDestructive = true,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-slate-800 border border-slate-700 p-5 sm:p-6 shadow-2xl text-slate-100 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0">
        {/* Mobile Drag Indicator */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-600 rounded-full mx-auto mb-3 shrink-0" />

        <div className="flex items-start justify-between border-b border-slate-700 pb-3 mb-4">
          <div className="flex items-center gap-3">
            {isDestructive && (
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
            )}
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{message}</p>

        <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-700">
          <button
            id="btn-confirm-cancel"
            type="button"
            onClick={onCancel}
            className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 rounded-lg border border-slate-600 bg-slate-700 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-slate-600 transition cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            id="btn-confirm-action"
            type="button"
            onClick={onConfirm}
            className={`flex-1 sm:flex-initial min-h-[44px] px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-white transition cursor-pointer shadow-sm ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-500'
                : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
