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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-confirm-title"
      onClick={confirming ? undefined : onCancel}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0d1320] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="tx-confirm-title" className="text-sm font-semibold">
          {title}
        </p>
        <p className="mt-1 text-xs text-white/60">Review before confirming.</p>

        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-xs text-white/50">Recipient</dt>
            <dd className="mt-0.5 font-medium">{recipient}</dd>
          </div>
          <div>
            <dt className="text-xs text-white/50">Amount</dt>
            <dd className="mt-0.5 text-lg font-semibold tracking-tight">
              {amount} <span className="text-base font-medium text-white/70">{token}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-white/50">Network</dt>
            <dd className="mt-0.5 font-medium">{network}</dd>
          </div>
        </dl>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={confirming}
            onClick={onCancel}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={confirming}
            onClick={onConfirm}
            className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#070b14] disabled:opacity-50"
          >
            {confirming ? "Confirming…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
