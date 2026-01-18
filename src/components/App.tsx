import { useState } from 'react';
import { Header } from './Header';
import { TeamMemberList } from './TeamMemberList';
import { Calendar } from './Calendar';
import { ChoreModal } from './ChoreModal';
import { Chore } from '../types';

export function App() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editChore, setEditChore] = useState<Chore | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();

  const handleDateClick = (date: string) => {
    setEditChore(null);
    setSelectedDate(date);
    setModalOpen(true);
  };

  const handleEventClick = (chore: Chore) => {
    setEditChore(chore);
    setSelectedDate(undefined);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditChore(null);
    setSelectedDate(undefined);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <TeamMemberList />
        <Calendar onDateClick={handleDateClick} onEventClick={handleEventClick} />
      </div>
      <ChoreModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        editChore={editChore}
        defaultDate={selectedDate}
      />
    </div>
  );
}
