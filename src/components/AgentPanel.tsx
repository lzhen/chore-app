import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  analyzeWorkloadBalance,
  autoAssignChores,
  getUpcomingChores,
  suggestAssignee,
} from '../utils/schedulingAgent';
import {
  areNotificationsEnabled,
  requestNotificationPermission,
  checkAndNotifyUpcomingChores,
} from '../utils/notifications';
import {
  isGoogleCalendarConfigured,
  initGoogleApi,
  isGoogleSignedIn,
  signInToGoogle,
  signOutFromGoogle,
  syncChoresToGoogleCalendar,
} from '../utils/googleCalendar';
import { createPortal } from 'react-dom';
import '../styles/planning-tools.css';
import { ChatAssistant } from './ChatAssistant';

export function AgentPanel({ suspended = false, showTrigger = true }: { suspended?: boolean; showTrigger?: boolean }) {
  const { state, updateChore } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [section, setSection] = useState<'chat' | 'planning'>('chat');
  const panel = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const visible = isOpen && !suspended;
  useEffect(() => { if (suspended) setIsOpen(false); }, [suspended]);
  useEffect(() => {
    if (!visible) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    const oldInert = root?.inert || false;
    const oldOverflow = document.body.style.overflow;
    const media = window.matchMedia('(max-width: 1099px)');
    const adapt = () => {
      if (root) root.inert = media.matches || oldInert;
      document.body.style.overflow = media.matches ? 'hidden' : oldOverflow;
      document.body.classList.toggle('nesmi-assistant-docked', !media.matches);
      panel.current?.setAttribute('aria-modal', String(media.matches));
      if (media.matches && !panel.current?.contains(document.activeElement)) panel.current?.focus();
    };
    adapt(); media.addEventListener('change', adapt);
    panel.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (media.matches || panel.current?.contains(document.activeElement))) { event.preventDefault(); event.stopPropagation(); setIsOpen(false); }
      if (event.key !== 'Tab' || !media.matches || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(el => el.getClientRects().length > 0);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      media.removeEventListener('change', adapt); document.removeEventListener('keydown', key, true);
      if (root) root.inert = oldInert; document.body.style.overflow = oldOverflow; document.body.classList.remove('nesmi-assistant-docked');
      if (document.activeElement === document.body || panel.current?.contains(document.activeElement)) (trigger.current || previous)?.focus();
    };
  }, [visible]);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [googleSignedIn, setGoogleSignedIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: number; failed: number } | null>(null);

  const analysis = analyzeWorkloadBalance(state.chores, state.teamMembers);
  const upcomingChores = getUpcomingChores(state.chores);
  const unassignedCount = state.chores.filter((c) => !c.assigneeId).length;
  const suggestedMember = suggestAssignee(state.chores, state.teamMembers);

  // Check notification permission on mount
  useEffect(() => {
    setNotificationsEnabled(areNotificationsEnabled());
  }, []);

  // Initialize Google Calendar API
  useEffect(() => {
    const configured = isGoogleCalendarConfigured();
    setGoogleConfigured(configured);
    if (configured) {
      initGoogleApi().then(() => {
        setGoogleSignedIn(isGoogleSignedIn());
      });
    }
  }, []);

  // Check for upcoming chores and send notifications
  useEffect(() => {
    if (notificationsEnabled && state.chores.length > 0) {
      checkAndNotifyUpcomingChores(state.chores, state.teamMembers);
    }
  }, [notificationsEnabled, state.chores, state.teamMembers]);

  const handleAutoAssign = async () => {
    setIsAutoAssigning(true);
    const assignments = autoAssignChores(state.chores, state.teamMembers);

    for (const [choreId, memberId] of assignments) {
      const chore = state.chores.find((c) => c.id === choreId);
      if (chore) {
        await updateChore({ ...chore, assigneeId: memberId });
      }
    }

    setIsAutoAssigning(false);
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotificationsEnabled(granted);
    if (granted) {
      checkAndNotifyUpcomingChores(state.chores, state.teamMembers);
    }
  };

  const handleGoogleSignIn = async () => {
    const success = await signInToGoogle();
    setGoogleSignedIn(success);
  };

  const handleGoogleSignOut = () => {
    signOutFromGoogle();
    setGoogleSignedIn(false);
    setSyncResult(null);
  };

  const handleSyncToGoogle = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    const result = await syncChoresToGoogleCalendar(state.chores, state.teamMembers);
    setSyncResult(result);
    setIsSyncing(false);
  };

  return (
    <>
      {/* Floating Agent Button */}
      {showTrigger && !suspended && <button
        ref={trigger}
        onClick={() => setIsOpen(!isOpen)}
        className="nesmi-agent-trigger rounded-full flex items-center justify-center"
        aria-label="Calendar Agent" aria-expanded={visible} aria-controls="nesmi-assistant"
        title="Calendar Agent"
      >
        <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        {(unassignedCount > 0 || !analysis.isBalanced) && (
          <span className="nesmi-agent-badge absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unassignedCount > 99 ? '99+' : unassignedCount > 0 ? unassignedCount : '!'}
          </span>
        )}
      </button>}

      {createPortal(<section ref={panel} id="nesmi-assistant" className="nesmi-assistant" role="dialog" aria-label="Assistant" tabIndex={-1} hidden={!visible}>
        <header className="nesmi-assistant-header"><h2>Assistant</h2><button type="button" className="touch-button" aria-label="Close assistant" onClick={() => setIsOpen(false)}>✕</button></header>
        <div className="nesmi-assistant-tabs" role="tablist" aria-label="Assistant sections">
          {(['chat', 'planning'] as const).map(name => <button key={name} type="button" role="tab" id={`assistant-tab-${name}`} aria-selected={section === name} aria-controls={`assistant-${name}`} tabIndex={section === name ? 0 : -1} onClick={() => setSection(name)} onKeyDown={event => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
              event.preventDefault(); const next = event.key === 'Home' ? 'chat' : event.key === 'End' ? 'planning' : section === 'chat' ? 'planning' : 'chat';
              setSection(next); document.getElementById(`assistant-tab-${next}`)?.focus();
            }
          }}>{name === 'chat' ? 'Chat' : 'Planning'}</button>)}
        </div>
        <div id="assistant-chat" role="tabpanel" aria-labelledby="assistant-tab-chat" className="nesmi-assistant-chat" hidden={section !== 'chat'}><ChatAssistant active={visible && section === 'chat'}/></div>
        <div id="assistant-planning" role="tabpanel" aria-labelledby="assistant-tab-planning" className="nesmi-assistant-planning" hidden={section !== 'planning'}>
          <p className="nesmi-assistant-description">Reminders, calendar sync, and a fair share of chores.</p>
          <div className="nesmi-agent-content nesmi-planning-tools space-y-4">
            {/* Notifications Toggle */}
            <div>
              <h4 className="text-sm font-medium text-content-primary mb-2">
                Notifications
              </h4>
              {notificationsEnabled ? (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-md text-green-600 dark:text-green-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span className="text-sm">Reminders enabled</span>
                </div>
              ) : (
                <button
                  onClick={handleEnableNotifications}
                  className="chore-button secondary w-full"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  Enable Reminders
                </button>
              )}
            </div>

            {/* Google Calendar Integration */}
            {googleConfigured && (
              <div>
                <h4 className="text-sm font-medium text-content-primary mb-2">
                  Google Calendar
                </h4>
                {googleSignedIn ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-md text-green-600 dark:text-green-400 text-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Connected
                    </div>
                    <button
                      onClick={handleSyncToGoogle}
                      disabled={isSyncing || state.chores.length === 0}
                      className="chore-button primary w-full"
                    >
                      {isSyncing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Syncing...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Sync to Google Calendar
                        </>
                      )}
                    </button>
                    {syncResult && (
                      <p className="text-xs text-center text-content-secondary">
                        Synced {syncResult.success} chore{syncResult.success !== 1 ? 's' : ''}
                        {syncResult.failed > 0 && `, ${syncResult.failed} failed`}
                      </p>
                    )}
                    <button
                      onClick={handleGoogleSignOut}
                      className="w-full py-1 px-2 text-content-secondary text-xs hover:text-content-primary transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleGoogleSignIn}
                    className="chore-button secondary w-full"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M19.5 22h-15A2.5 2.5 0 012 19.5v-15A2.5 2.5 0 014.5 2h15A2.5 2.5 0 0122 4.5v15a2.5 2.5 0 01-2.5 2.5zM9 18h6v-1H9v1zm3-2.5l3.5-3.5-1-1-2.5 2.5-2.5-2.5-1 1 3.5 3.5zM9 6v1h6V6H9z"
                      />
                    </svg>
                    Connect Google Calendar
                  </button>
                )}
              </div>
            )}

            {/* Workload Status */}
            <div>
              <h4 className="text-sm font-medium text-content-primary mb-2">
                Workload Balance
              </h4>
              <div
                className={`p-3 rounded-md ${
                  analysis.isBalanced
                    ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                }`}
              >
                {analysis.isBalanced ? (
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm">Workload is balanced</span>
                  </div>
                ) : (
                  <div className="text-sm space-y-1">
                    {analysis.suggestions.map((s, i) => (
                      <p key={i}>{s}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Team Stats */}
            {analysis.stats.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-content-primary mb-2">
                  Team Stats (Last 7 Days)
                </h4>
                <div className="space-y-2">
                  {analysis.stats.map((stat) => (
                    <div
                      key={stat.memberId}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-content-secondary">{stat.memberName}</span>
                      <span className="text-content-primary font-medium">
                        {stat.recentAssignments} chores
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Chores */}
            {upcomingChores.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-content-primary mb-2">
                  Due Today/Tomorrow
                </h4>
                <div className="space-y-1">
                  {upcomingChores.slice(0, 5).map((chore) => (
                    <div
                      key={chore.id}
                      className="text-sm text-content-secondary flex items-center gap-2"
                    >
                      <span className="w-2 h-2 rounded-full bg-accent"></span>
                      {chore.title}
                    </div>
                  ))}
                  {upcomingChores.length > 5 && (
                    <p className="text-xs text-content-secondary">
                      +{upcomingChores.length - 5} more
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Suggested Assignee */}
            {suggestedMember && (
              <div className="p-3 bg-accent/10 rounded-md">
                <p className="text-sm text-content-accent">
                  <strong>Suggestion:</strong> Assign next chore to{' '}
                  <strong>{suggestedMember.name}</strong> (least busy)
                </p>
              </div>
            )}

            {/* Auto-Assign Button */}
            {unassignedCount > 0 && state.teamMembers.length > 0 && (
              <button
                onClick={handleAutoAssign}
                disabled={isAutoAssigning}
                className="w-full py-2 px-4 bg-accent text-white rounded-md font-medium hover:bg-accent-hover disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {isAutoAssigning ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Assigning...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    Auto-Assign {unassignedCount} Chore{unassignedCount !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </section>, document.body)}
    </>
  );
}
