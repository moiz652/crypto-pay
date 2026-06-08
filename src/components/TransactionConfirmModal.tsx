"use client";

type TransactionConfirmModalProps = {
  open: boolean;
  title: string;
  recipient: string;
  amount: string;
  token: string;
  network: string;
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function TransactionConfirmModal({
  open,
  title,
  recipient,
  amount,
  token,
  network,
  confirming = false,
  onConfirm,
  onCancel,
}: TransactionConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-confirm-title"
      onClick={confirming ? undefined : onCancel}
    >
      <div
        className="modal-panel w-full max-w-sm rounded-2xl border border-[#1E2538] bg-[#151A2E] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00D4AA]/10 border border-[#00D4AA]/20">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
        </div>

        <p id="tx-confirm-title" className="text-center text-base font-semibold">
          {title}
        </p>
        <p className="mt-1 text-center text-xs text-[#8B95A5]">Review before confirming</p>

        <div className="mt-5 rounded-xl bg-[#0B0F19] border border-[#1E2538] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8B95A5]">Recipient</span>
            <span className="text-sm font-medium">{recipient}</span>
          </div>
          <div className="border-t border-[#1E2538]" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8B95A5]">Amount</span>
            <span className="text-lg font-semibold tracking-tight">
              ${amount} <span className="text-sm font-medium text-[#8B95A5]">{token}</span>
            </span>
          </div>
          <div className="border-t border-[#1E2538]" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8B95A5]">Network</span>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-[#00D4AA]" />
              <span className="text-sm font-medium">{network}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={confirming}
            onClick={onCancel}
            className="rounded-xl border border-[#1E2538] bg-transparent px-4 py-3 text-sm font-semibold hover:bg-white/[0.03] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={confirming}
            onClick={onConfirm}
            className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#070b14] hover:scale-105 hover:brightness-110 transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {confirming && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#070b14]/30 border-t-[#070b14]" />
            )}
            {confirming ? "Confirming…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}