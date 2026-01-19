interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { key: 'c', description: 'Create new chore' },
  { key: 't', description: 'Go to today' },
  { key: '→ or j', description: 'Next period' },
  { key: '← or k', description: 'Previous period' },
  { key: '1 or d', description: 'Day view' },
  { key: '2 or w', description: 'Week view' },
  { key: '3 or m', description: 'Month view' },
  { key: '4 or a', description: 'Agenda view' },
  { key: '/', description: 'Focus search' },
  { key: 'Escape', description: 'Close modal/popover' },
  { key: '?', description: 'Show keyboard shortcuts' },
];

export function ShortcutsHelpModal({ isOpen, onClose }: ShortcutsHelpModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-overlay flex items-center justify-center z-[200] p-4"
      onClick={onClose}
    >
      <div
        className="fluent-card w-full max-w-md animate-fluent-appear"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="fluent-title text-lg font-semibold text-content-primary">
            Keyboard Shortcuts
          </h3>
          <button
            onClick={onClose}
            className="text-content-secondary hover:text-content-primary hover:bg-subtle-background-hover rounded-fluent-sm transition-all duration-fast p-1.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="p-6">
          <div className="space-y-2">
            {shortcuts.map((shortcut) => (
              <div
                key={shortcut.key}
                className="flex items-center justify-between py-1"
              >
                <span className="text-sm text-content-secondary">{shortcut.description}</span>
                <kbd className="px-2 py-1 text-xs font-mono bg-surface-tertiary text-content-primary rounded-fluent-sm border border-border">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border">
          <p className="text-xs text-content-secondary text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-surface-tertiary rounded border border-border">?</kbd> anytime to show this help
          </p>
        </div>
      </div>
    </div>
  );
}
