import { useState } from 'react';
import { Header } from './Header';
import { TeamMemberList } from './TeamMemberList';
import { Calendar } from './Calendar';
import { ChoreModal } from './ChoreModal';
import { AuthForm } from './AuthForm';
import { AgentPanel } from './AgentPanel';
import { Chore } from '../types';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

export function App() {
  const { state } = useApp();
  const { user, loading: authLoading } = useAuth();
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

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth form if not logged in
  if (!user) {
    return <AuthForm />;
  }

  // Show loading while fetching data
  if (state.loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading chores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
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
      <AgentPanel />
    </div>
  );
}
