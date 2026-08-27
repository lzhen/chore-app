interface QuickAddButtonProps {
  onClick: () => void;
}

export function QuickAddButton({ onClick }: QuickAddButtonProps) {
  return (
    <button
      onClick={onClick}
      className="material-fab fixed right-4 sm:right-6 flex items-center justify-center z-[140] transition-all active:scale-95"
      aria-label="Add new chore"
    >
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );
}
