import { Dialog } from './Dialog';
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

  return <Dialog title="Keyboard Shortcuts" variant="centered" onClose={onClose}>
    <div className="nesmi-shortcuts-help">
      <dl>{shortcuts.map(shortcut => <div key={shortcut.key}>
        <dt>{shortcut.description}</dt><dd><kbd>{shortcut.key}</kbd></dd>
      </div>)}</dl>
      <p>Press <kbd>?</kbd> to show this help when you are not typing in a field.</p>
    </div>
  </Dialog>;
}
