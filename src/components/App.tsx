import { useState } from 'react';
import { Header } from './Header';
import { TeamMemberList } from './TeamMemberList';
import { Calendar } from './Calendar';
import { ChoreModal } from './ChoreModal';
import { Chore } from '../types';

export function App() {
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
