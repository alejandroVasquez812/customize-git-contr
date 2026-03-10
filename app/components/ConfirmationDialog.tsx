interface ConfirmationDialogProps {
    isOpen: boolean;
    selectedCount: number;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmationDialog({
    isOpen,
    selectedCount,
    onConfirm,
    onCancel,
}: ConfirmationDialogProps) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
        >
            <div className="bg-gray-900 border border-border rounded-2xl p-8 shadow-card max-w-sm w-full text-center">
                <h2 id="confirm-title" className="text-xl font-bold text-white mb-3">
                    Confirm Submission
                </h2>
                <p className="text-gray-300 mb-6">
                    This will create backdated commits for{" "}
                    <strong className="text-white">{selectedCount}</strong>{" "}
                    date(s). This cannot be undone.
                </p>
                <div className="flex gap-4 justify-center">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-5 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="px-5 py-2 rounded-lg bg-gradient-to-r from-primary-light to-primary-dark text-white font-semibold hover:scale-105 transition-transform focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}