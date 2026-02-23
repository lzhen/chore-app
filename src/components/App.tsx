import { useState, useRef, useMemo, useCallback } from 'react';
import { Header } from './Header';
import { TeamMemberList } from './TeamMemberList';
import { Calendar, CalendarRef } from './Calendar';
import { ListView } from './ListView';
import { ChoreModal } from './ChoreModal';
import { AuthForm } from './AuthForm';
import { AgentPanel } from './AgentPanel';
import { Dashboard } from './Dashboard';
import { MemberProfileModal } from './MemberProfileModal';
import { AvailabilityModal } from './AvailabilityModal';
import { QuickAddButton } from './QuickAddButton';
import { ShortcutsHelpModal } from './ShortcutsHelpModal';
import { EmailVerification } from './EmailVerification';
import { PasswordReset } from './PasswordReset';
import { Chore, ViewMode, TeamMember } from '../types';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { generateChoreInstances, getCalendarRange } from '../utils/recurrence';

interface ChoreDefaultValues {
  date?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
}

export function App() {
  const { state } = useApp();
  const { user, loading: authLoading, isEmailVerification, isPasswordReset, clearEmailVerification, clearPasswordReset } = useAuth();
  const calendarRef = useRef<CalendarRef>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editChore, setEditChore] = useState<Chore | null>(null);
  const [instanceDate, setInstanceDate] = useState<string | undefined>(undefined);
  const [defaultValues, setDefaultValues] = useState<ChoreDefaultValues | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [searchQuery, setSearchQuery] = useState('');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [hiddenMembers, setHiddenMembers] = useState<Set<string>>(new Set());
  const [profileMember, setProfileMember] = useState<TeamMember | null>(null);
  const [availabilityMember, setAvailabilityMember] = useState<TeamMember | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Compute event dates for mini calendar
  const eventDates = useMemo(() => {
    const { start, end } = getCalendarRange();
    const instances = generateChoreInstances(
      state.chores,
      state.teamMembers,
      state.completions,
      start,
      end
    );
    return new Set(instances.map(i => i.date));
  }, [state.chores, state.teamMembers, state.completions]);

  // Navigate calendar to a specific date
  const handleMiniCalendarDateSelect = useCallback((date: Date) => {
    calendarRef.current?.gotoDate(date);
  }, []);

  // Toggle member visibility
  const handleToggleMemberVisibility = useCallback((memberId: string) => {
    setHiddenMembers(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }, []);

  const handleAddClick = (values?: ChoreDefaultValues) => {
    setEditChore(null);
    setInstanceDate(undefined);
    setDefaultValues(values);
    setModalOpen(true);
  };

  const handleEventClick = (chore: Chore, date: string) => {
    setEditChore(chore);
    setInstanceDate(date);
    setDefaultValues(undefined);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditChore(null);
    setInstanceDate(undefined);
    setDefaultValues(undefined);
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleDashboardClick = () => {
    setDashboardOpen(true);
  };

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ignore if in input/textarea (except for Escape)
    const isInput = (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA';

    if (e.key === 'Escape') {
      if (shortcutsOpen) {
        setShortcutsOpen(false);
        return;
      }
      if (profileMember) {
        setProfileMember(null);
        return;
      }
      if (availabilityMember) {
        setAvailabilityMember(null);
        return;
      }
      if (modalOpen) {
        handleCloseModal();
        return;
      }
      if (dashboardOpen) {
        setDashboardOpen(false);
        return;
      }
      // Blur search input on Escape
      if (document.activeElement === searchInputRef.current) {
        searchInputRef.current?.blur();
        return;
      }
    }

    // Other shortcuts only work when not in input
    if (isInput) return;

    switch (e.key.toLowerCase()) {
      case 'c':
        if (!modalOpen && !dashboardOpen && !shortcutsOpen) {
          handleAddClick();
        }
        break;
      case 't':
        calendarRef.current?.today();
        break;
      case '?':
        setShortcutsOpen(true);
        break;
      case '/':
        e.preventDefault();
        searchInputRef.current?.focus();
        break;
      // View switching: 1/d = day, 2/w = week, 3/m = month, 4/a = agenda/list
      case '1':
      case 'd':
        if (viewMode === 'calendar') {
          calendarRef.current?.changeView('timeGridDay');
        }
        break;
      case '2':
      case 'w':
        if (viewMode === 'calendar') {
          calendarRef.current?.changeView('timeGridWeek');
        }
        break;
      case '3':
      case 'm':
        if (viewMode === 'calendar') {
          calendarRef.current?.changeView('dayGridMonth');
        }
        break;
      case '4':
      case 'a':
        if (viewMode === 'calendar') {
          calendarRef.current?.changeView('listWeek');
        } else {
          setViewMode('list');
        }
        break;
      // Navigation: j/ArrowRight = next, k/ArrowLeft = prev
      case 'j':
      case 'arrowright':
        calendarRef.current?.next();
        break;
      case 'k':
      case 'arrowleft':
        calendarRef.current?.prev();
        break;
    }
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

  // Show email verification page
  if (isEmailVerification) {
    return <EmailVerification onContinue={clearEmailVerification} />;
  }

  // Show password reset page
  if (isPasswordReset) {
    return <PasswordReset onComplete={clearPasswordReset} />;
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
      <div className="theme-background" aria-hidden="true" />
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div className="h-screen flex flex-col relative" onKeyDown={handleKeyDown} tabIndex={-1}>
        <Header
          onMenuClick={toggleSidebar}
          onDashboardClick={handleDashboardClick}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchInputRef={searchInputRef}
        />
        <main id="main-content" className="flex flex-1 overflow-hidden relative">
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
            <TeamMemberList
              onClose={() => setSidebarOpen(false)}
              onDateSelect={handleMiniCalendarDateSelect}
              eventDates={eventDates}
              hiddenMembers={hiddenMembers}
              onToggleMemberVisibility={handleToggleMemberVisibility}
              onProfileOpen={setProfileMember}
              onAvailabilityOpen={setAvailabilityMember}
            />
          </div>
          {viewMode === 'calendar' ? (
            <Calendar
              ref={calendarRef}
              onAddClick={handleAddClick}
              onEventClick={handleEventClick}
              searchQuery={searchQuery}
              hiddenMembers={hiddenMembers}
            />
          ) : (
            <ListView onAddClick={handleAddClick} onEventClick={handleEventClick} />
          )}
        </main>
        <ChoreModal
          isOpen={modalOpen}
          onClose={handleCloseModal}
          editChore={editChore}
          instanceDate={instanceDate}
          defaultValues={defaultValues}
        />
        <AgentPanel />
        <QuickAddButton onClick={() => handleAddClick()} />
        {dashboardOpen && <Dashboard onClose={() => setDashboardOpen(false)} />}
        {profileMember && <MemberProfileModal member={profileMember} onClose={() => setProfileMember(null)} />}
        {availabilityMember && <AvailabilityModal member={availabilityMember} onClose={() => setAvailabilityMember(null)} />}
        <ShortcutsHelpModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </div>
    </>
  );
}
