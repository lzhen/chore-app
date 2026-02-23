interface QuickAddButtonProps {
  onClick: () => void;
}

export function QuickAddButton({ onClick }: QuickAddButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 w-14 h-14 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-full shadow-lg flex items-center justify-center z-30 transition-all hover:scale-105 active:scale-95"
      aria-label="Add new chore"
    >
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );
}
