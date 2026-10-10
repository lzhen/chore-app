import { LoadingScreen } from './LoadingScreen';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Header } from './Header';
import { Dialog } from './Dialog';
import { TeamMemberList } from './TeamMemberList';
import { Calendar, CalendarRef } from './Calendar';
import { ListView } from './ListView';
import { ChoreModal, type ChoreDefaultValues, type ChoreEditorHandle } from './ChoreModal';
import { AuthForm } from './AuthForm';
import { AccountSettings } from './AccountSettings';
import { AgentPanel } from './AgentPanel';
import { ChatAssistant } from './ChatAssistant';
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

export function App() {
  const { state, reload } = useApp();
  const { user, loading: authLoading, isEmailVerification, isPasswordReset, clearEmailVerification, clearPasswordReset } = useAuth();
  const calendarRef = useRef<CalendarRef>(null);
  const activeEditorRef = useRef<ChoreEditorHandle>(null);
  const requestTransition = useCallback((action: () => void) => {
    if(activeEditorRef.current)activeEditorRef.current.requestTransition(action);else action();
  }, []);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if((window as Window & {__NESMI_PREVIEW__?:boolean}).__NESMI_PREVIEW__ !== true || event.origin !== window.location.origin || event.source !== window.parent)return;
      const message=event.data;
      if(!message || message.type !== 'nesmi-preview-mode-request' || !['web','app'].includes(message.experience) || typeof message.requestId !== 'string')return;
      requestTransition(() => window.parent.postMessage({type:'nesmi-preview-mode-ready',experience:message.experience,requestId:message.requestId},window.location.origin));
    };
    window.addEventListener('message',receive);
    return ()=>window.removeEventListener('message',receive);
  }, [requestTransition]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editChore, setEditChore] = useState<Chore | null>(null);
  const [instanceDate, setInstanceDate] = useState<string | undefined>(undefined);
  const [defaultValues, setDefaultValues] = useState<ChoreDefaultValues | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const navigate = (mode: ViewMode, focusContent = true) => requestTransition(() => {
    setViewMode(mode); setSidebarOpen(false); setToolsOpen(false); setSearchQuery('');
    if (focusContent) requestAnimationFrame(() => {
      const heading = mainRef.current?.querySelector<HTMLElement>('h1,h2');
      if (heading) { heading.tabIndex = -1; heading.focus(); } else mainRef.current?.focus();
    });
  });

  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [hiddenMembers, setHiddenMembers] = useState<Set<string>>(new Set());
  const [profileMember, setProfileMember] = useState<TeamMember | null>(null);
  const [availabilityMember, setAvailabilityMember] = useState<TeamMember | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Toggle member visibility
  const handleToggleMemberVisibility = useCallback((memberId: string) => requestTransition(() => {
    setHiddenMembers(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }), [requestTransition]);

  const handleAddClick = (values?: ChoreDefaultValues) => requestTransition(() => {
    setEditChore(null);
    setInstanceDate(undefined);
    setDefaultValues(values);
    setModalOpen(true);
  });

  const handleEventClick = (chore: Chore, date: string) => requestTransition(() => {
    setEditChore(chore);
    setInstanceDate(date);
    setDefaultValues(undefined);
    setModalOpen(true);
  });

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditChore(null);
    setInstanceDate(undefined);
    setDefaultValues(undefined);
  };

  const toggleSidebar = () => requestTransition(() => {
    setSidebarOpen(!sidebarOpen);
  });

  const handleDashboardClick = () => {
    navigate('dashboard');
  };

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if(e.defaultPrevented)return;
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
        requestTransition(()=>{});
        return;
      }
      if (viewMode === 'dashboard') {
        navigate('today');
        return;
      }
      // Blur search input on Escape
      if (document.activeElement === searchInputRef.current) {
        searchInputRef.current?.blur();
        return;
      }
    }

    // Other shortcuts only work when not in input
    if (isInput || (e.target as HTMLElement).isContentEditable || e.ctrlKey || e.metaKey || e.altKey || sidebarOpen || chatOpen || toolsOpen) return;

    switch (e.key.toLowerCase()) {
      case 'c':
        if (!modalOpen && !shortcutsOpen) {
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
          navigate('list');
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
  if (authLoading) return <LoadingScreen phase="session" />;

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

  // Keep the incoming Today layout stable while its data arrives.
  if (state.loading) return <LoadingScreen phase="chores" />;

  if(state.error) return <div className="chore-load-error"><h1>Let’s try that again.</h1><p role="alert">{state.error}</p><button className="chore-button primary" onClick={reload}>Retry</button></div>;
  return <><div className="theme-background" aria-hidden="true"/><a className="skip-link" href="#main-content">Skip to main content</a>
   <div className="chore-app" data-view={viewMode} onKeyDown={handleKeyDown} tabIndex={-1}>
    <Header menuOpen={sidebarOpen} onMenuClick={toggleSidebar} onDashboardClick={handleDashboardClick} viewMode={viewMode} onViewModeChange={mode=>navigate(mode,false)} searchQuery={searchQuery} onSearchChange={query=>requestTransition(()=>setSearchQuery(query))} searchInputRef={searchInputRef}/>
    <main id="main-content" className="chore-main" ref={mainRef} tabIndex={-1}>
    {sidebarOpen&&<Dialog variant="drawer" title="Your home" onClose={()=>setSidebarOpen(false)}>
      <nav className="nesmi-drawer-nav" aria-label="Primary navigation">{([
        ['today','Today'],['list','Chores'],['calendar','Calendar'],['dashboard','Insights'],['account','Account']
      ] as [ViewMode,string][]).map(([id,label])=><button key={id} aria-current={viewMode===id?'page':undefined} onClick={()=>navigate(id)}>{label}<span aria-hidden="true">{viewMode===id?'●':'›'}</span></button>)}</nav>
      <TeamMemberList hiddenMembers={hiddenMembers} onToggleMemberVisibility={handleToggleMemberVisibility} onProfileOpen={m=>{setSidebarOpen(false);setProfileMember(m);}} onAvailabilityOpen={m=>{setSidebarOpen(false);setAvailabilityMember(m);}}/>
    </Dialog>}
    {viewMode==='calendar'&&<><div className="nesmi-planning-heading"><h2>Calendar</h2><button className="chore-button secondary" onClick={()=>setToolsOpen(true)}>Planning tools</button></div><Calendar ref={calendarRef} onAddClick={handleAddClick} onEventClick={handleEventClick} searchQuery={searchQuery} hiddenMembers={hiddenMembers}/></>}
    {(viewMode==='today'||viewMode==='list')&&<ListView key={viewMode} editorRef={activeEditorRef} todayView={viewMode==='today'} homeView={viewMode==='today'} onChatClick={()=>requestTransition(()=>setChatOpen(true))} onManageFamily={()=>requestTransition(()=>setSidebarOpen(true))} onAddClick={()=>handleAddClick()} onEventClick={handleEventClick} searchQuery={searchQuery} hiddenMembers={hiddenMembers} onClearFilters={()=>{setSearchQuery('');setHiddenMembers(new Set());}}/>}
    {viewMode==='dashboard'&&(state.chores.length>0?<Dashboard embedded onClose={()=>setViewMode('today')}/>:<section className="chore-list-page"><div className="chore-empty"><h2>Small wins will show up here.</h2><p>Add your first chore to start seeing your household’s progress.</p><p>Use the + below to add your first chore.</p></div></section>)}
    {viewMode==='account'&&<AccountSettings embedded isOpen onClose={()=>setViewMode('today')}/>}
    </main>
    <div className="nesmi-add-bar" aria-label="Nesmi create"><QuickAddButton onClick={()=>handleAddClick()}/></div>
   </div>
   <ChatAssistant open={chatOpen} suspended={modalOpen||!!profileMember||!!availabilityMember||sidebarOpen||toolsOpen||shortcutsOpen} onClose={()=>setChatOpen(false)}/>
   {toolsOpen&&<AgentPanel initialOpen onChatOpen={()=>{setToolsOpen(false);setChatOpen(true);}} onDismiss={()=>setToolsOpen(false)}/>}
   <ChoreModal editorRef={activeEditorRef} isOpen={modalOpen} onClose={handleCloseModal} editChore={editChore} instanceDate={instanceDate} defaultValues={defaultValues}/>
   {profileMember&&<MemberProfileModal member={profileMember} onClose={()=>setProfileMember(null)}/>}
   {availabilityMember&&<AvailabilityModal member={availabilityMember} onClose={()=>setAvailabilityMember(null)}/>}
   <ShortcutsHelpModal isOpen={shortcutsOpen} onClose={()=>setShortcutsOpen(false)}/>
  </>;
}
