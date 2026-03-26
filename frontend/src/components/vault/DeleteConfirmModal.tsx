'use client';

import { AlertTriangle } from 'lucide-react';

interface Props {
  itemName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({ itemName, onConfirm, onCancel }: Props) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-100 mb-1">Delete item?</h3>
          <p className="text-slate-400 text-sm mb-2">
            <span className="text-slate-200 font-medium">{itemName}</span> will be permanently
            deleted from your vault.
          </p>
          <p className="text-slate-500 text-xs mb-6">This action cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
            <button onClick={onConfirm} className="btn-danger flex-1 bg-red-600/30 hover:bg-red-600/50 text-red-300 border-red-500/40">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
