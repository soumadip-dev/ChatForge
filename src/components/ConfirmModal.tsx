type ConfirmModalProps = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'success';
  onCancel: () => void;
  onConfirm: () => void;
};

function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'success',
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const confirmClass =
    tone === 'danger'
      ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-200'
      : 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-200';

  return (
    <div
      aria-labelledby="confirm-title"
      aria-modal="true"
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
      role="dialog"
    >
      <section className="w-full max-w-md rounded-lg border border-green-500/35 bg-gray-950 p-6 text-white shadow-2xl shadow-green-950/40">
        <h2 className="text-2xl font-bold" id="confirm-title">
          {title}
        </h2>
        <p className="mt-3 leading-7 text-gray-300">{message}</p>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            autoFocus
            className="rounded-lg border border-white/20 bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/20"
            onClick={onCancel}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className={`rounded-lg px-5 py-3 font-semibold transition focus:outline-none focus:ring-2 ${confirmClass}`}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export default ConfirmModal;
