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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <>
        <div className="theme-background" />
        <div className="h-screen flex items-center justify-center">
          <div className="text-center glass-card p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
            <p className="mt-4 text-content-secondary">Loading...</p>
          </div>
        </div>
      </>
    );
  }

  // Show auth form if not logged in
  if (!user) {
    return <AuthForm />;
  }

  // Show loading while fetching data
  if (state.loading) {
    return (
      <>
        <div className="theme-background" />
        <div className="h-screen flex items-center justify-center">
          <div className="text-center glass-card p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
            <p className="mt-4 text-content-secondary">Loading chores...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="theme-background" />
      <div className="h-screen flex flex-col relative">
        <Header onMenuClick={toggleSidebar} />
        <div className="flex flex-1 overflow-hidden relative">
          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          {/* Sidebar */}
          <div
            className={`
              fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
              transform transition-transform duration-300 ease-in-out
              ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}
          >
            <TeamMemberList onClose={() => setSidebarOpen(false)} />
          </div>
          <Calendar onAddClick={handleAddClick} onEventClick={handleEventClick} />
        </div>
        <ChoreModal
          isOpen={modalOpen}
          onClose={handleCloseModal}
          editChore={editChore}
        />
        <AgentPanel />
      </div>
    </>
  );
}
