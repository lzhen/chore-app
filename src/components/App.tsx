import { useState, useRef, useMemo, useCallback } from 'react';
import { Header } from './Header';
import { TeamMemberList } from './TeamMemberList';
import { Calendar, CalendarRef } from './Calendar';
import { ListView } from './ListView';
import { ChoreModal } from './ChoreModal';
import { AuthForm } from './AuthForm';
import { AccountSettings } from './AccountSettings';
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
  const { state, reload } = useApp();
  const { user, loading: authLoading, isEmailVerification, isPasswordReset, clearEmailVerification, clearPasswordReset } = useAuth();
  const calendarRef = useRef<CalendarRef>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editChore, setEditChore] = useState<Chore | null>(null);
  const [instanceDate, setInstanceDate] = useState<string | undefined>(undefined);
  const [defaultValues, setDefaultValues] = useState<ChoreDefaultValues | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>(()=>window.innerWidth<768?'today':'calendar');
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
    setViewMode('dashboard');
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
      if (viewMode === 'dashboard') {
        setViewMode('today');
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
        if (!modalOpen && viewMode !== 'dashboard' && !shortcutsOpen) {
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

  if(state.error) return <div className="chore-load-error"><h1>Let’s try that again.</h1><p role="alert">{state.error}</p><button className="chore-button primary" onClick={reload}>Retry</button></div>;
  return <><div className="theme-background" aria-hidden="true"/><a className="skip-link" href="#main-content">Skip to main content</a>
   <div className="chore-app" onKeyDown={handleKeyDown} tabIndex={-1}>
    <Header onMenuClick={toggleSidebar} onDashboardClick={handleDashboardClick} viewMode={viewMode} onViewModeChange={mode=>{setViewMode(mode);setSidebarOpen(false);}} searchQuery={searchQuery} onSearchChange={setSearchQuery} searchInputRef={searchInputRef}/>
    <main id="main-content" className="chore-main">
    {sidebarOpen&&<div className="family-overlay"><button className="family-backdrop" aria-label="Close family menu" onClick={()=>setSidebarOpen(false)}/><aside className="family-panel"><TeamMemberList onClose={()=>setSidebarOpen(false)} onDateSelect={handleMiniCalendarDateSelect} eventDates={eventDates} hiddenMembers={hiddenMembers} onToggleMemberVisibility={handleToggleMemberVisibility} onProfileOpen={m=>{setSidebarOpen(false);setProfileMember(m);}} onAvailabilityOpen={m=>{setSidebarOpen(false);setAvailabilityMember(m);}}/></aside></div>}
    {viewMode==='calendar'&&<Calendar ref={calendarRef} onAddClick={handleAddClick} onEventClick={handleEventClick} searchQuery={searchQuery} hiddenMembers={hiddenMembers}/>}
    {(viewMode==='today'||viewMode==='list')&&<ListView key={viewMode} todayView={viewMode==='today'} onAddClick={()=>handleAddClick()} onEventClick={handleEventClick} searchQuery={searchQuery} hiddenMembers={hiddenMembers}/>}
    {viewMode==='dashboard'&&<Dashboard embedded onClose={()=>setViewMode('today')}/>}
    {viewMode==='account'&&<AccountSettings embedded isOpen onClose={()=>setViewMode('today')}/>}
    </main>
    {!modalOpen&&!profileMember&&!availabilityMember&&!sidebarOpen&&['today','calendar','list'].includes(viewMode)&&<QuickAddButton onClick={()=>handleAddClick()}/>}
    {viewMode==='calendar'&&!modalOpen&&<div className="chore-desktop-assistant"><AgentPanel/></div>}
   </div>
   <ChoreModal isOpen={modalOpen} onClose={handleCloseModal} editChore={editChore} instanceDate={instanceDate} defaultValues={defaultValues}/>
   {profileMember&&<MemberProfileModal member={profileMember} onClose={()=>setProfileMember(null)}/>}
   {availabilityMember&&<AvailabilityModal member={availabilityMember} onClose={()=>setAvailabilityMember(null)}/>}
   <ShortcutsHelpModal isOpen={shortcutsOpen} onClose={()=>setShortcutsOpen(false)}/>
  </>;
}
