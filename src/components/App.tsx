import { useState } from 'react';
import { Header } from './Header';
import { TeamMemberList } from './TeamMemberList';
import { Calendar } from './Calendar';
import { ChoreModal } from './ChoreModal';
import { Chore } from '../types';
import { useApp } from '../context/AppContext';

export function App() {
  const { state } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editChore, setEditChore] = useState<Chore | null>(null);

  const handleAddClick = () => {
    setEditChore(null);
    setModalOpen(true);
  };

  const handleEventClick = (chore: Chore) => {
    setEditChore(chore);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditChore(null);
  };

  if (state.loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <TeamMemberList />
        <Calendar onAddClick={handleAddClick} onEventClick={handleEventClick} />
      </div>
      <ChoreModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        editChore={editChore}
      />
    </div>
  );
}
