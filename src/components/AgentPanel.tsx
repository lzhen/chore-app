import '../styles/nesmi-secondary-surfaces.css';
import { useState, useEffect } from 'react';
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
import { Dialog } from './Dialog';
import { ChatAssistant } from './ChatAssistant';

export function AgentPanel({initialOpen=false,onDismiss,onChatOpen}:{initialOpen?:boolean;onDismiss?:()=>void;onChatOpen?:()=>void}={}) {
  const { state, updateChore } = useApp();
  const previewOnly = (window as Window & { __NESMI_PREVIEW__?: boolean }).__NESMI_PREVIEW__ === true;
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [isChatOpen, setIsChatOpen] = useState(false);
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
    if (!previewOnly) setNotificationsEnabled(areNotificationsEnabled());
  }, []);

  // Initialize Google Calendar API
  useEffect(() => {
    if (previewOnly) return;
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
    if (!previewOnly && notificationsEnabled && state.chores.length > 0) {
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
    if (previewOnly) return;
    const granted = await requestNotificationPermission();
    setNotificationsEnabled(granted);
    if (granted) {
      checkAndNotifyUpcomingChores(state.chores, state.teamMembers);
    }
  };

  const handleGoogleSignIn = async () => {
    if (previewOnly) return;
    const success = await signInToGoogle();
    setGoogleSignedIn(success);
  };

  const handleGoogleSignOut = () => {
    if (previewOnly) return;
    signOutFromGoogle();
    setGoogleSignedIn(false);
    setSyncResult(null);
  };

  const handleSyncToGoogle = async () => {
    if (previewOnly) return;
    setIsSyncing(true);
    setSyncResult(null);
    const result = await syncChoresToGoogleCalendar(state.chores, state.teamMembers);
    setSyncResult(result);
    setIsSyncing(false);
  };

  return (
    <>
      {/* Floating Agent Button */}
      {!initialOpen&&<button
        onClick={() => setIsOpen(!isOpen)}
        className="nesmi-agent-trigger rounded-full flex items-center justify-center"
        aria-label="Calendar Agent" aria-expanded={isOpen} aria-controls="nesmi-agent-panel"
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

      {/* Agent Panel */}
      {isOpen && (
        <Dialog title="Planning tools" variant="centered" onClose={()=>{setIsOpen(false);onDismiss?.();}}>
          <div className="nesmi-agent-content nesmi-secondary-surface p-4 space-y-4">
            {/* Chat Assistant Button */}
            <button
              onClick={() => {
                setIsOpen(false);
                if(onChatOpen) onChatOpen(); else setIsChatOpen(true);
              }}
              className="chore-button primary w-full"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              Chore assistant
            </button>

            {/* Notifications Toggle */}
            <div>
              <h4 className="nesmi-secondary-title mb-2">
                Notifications
              </h4>
              <p className="nesmi-secondary-support">Checks when you open these tools. No background reminders.</p>
              {previewOnly ? <p className="nesmi-secondary-support">Browser reminders are unavailable in this demo.</p> : notificationsEnabled ? (
                <div className="nesmi-planning-status nesmi-secondary-success-surface flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span className="nesmi-secondary-body">Browser reminders allowed</span>
                </div>
              ) : (
                <button
                  onClick={handleEnableNotifications}
                  className="chore-button secondary w-full"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  Allow browser reminders
                </button>
              )}
            </div>

            {/* Google Calendar Integration */}
            {(previewOnly || googleConfigured) && (
              <div>
                <h4 className="nesmi-secondary-title mb-2">
                  Google Calendar
                </h4>
                {previewOnly ? <p className="nesmi-secondary-support">Google Calendar connection is unavailable in this demo.</p> : googleSignedIn ? (
                  <div className="space-y-2">
                    <div className="nesmi-planning-status nesmi-secondary-success-surface nesmi-secondary-body flex items-center gap-2">
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
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
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
                      <p className="nesmi-secondary-support text-center">
                        Synced {syncResult.success} chore{syncResult.success !== 1 ? 's' : ''}
                        {syncResult.failed > 0 && `, ${syncResult.failed} failed`}
                      </p>
                    )}
                    <button
                      onClick={handleGoogleSignOut}
                      className="chore-button secondary w-full"
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
              <h4 className="nesmi-secondary-title mb-2">
                Workload Balance
              </h4>
              <div
                className={`nesmi-planning-status ${
                  analysis.isBalanced
                    ? 'nesmi-secondary-success-surface'
                    : 'nesmi-secondary-warning-surface'
                }`}
              >
                {analysis.isBalanced ? (
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="nesmi-secondary-body">Workload is balanced</span>
                  </div>
                ) : (
                  <div className="nesmi-secondary-body space-y-1">
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
                <h4 className="nesmi-secondary-title mb-2">
                  Team Stats (Last 7 Days)
                </h4>
                <div className="space-y-2">
                  {analysis.stats.map((stat) => (
                    <div
                      key={stat.memberId}
                      className="flex items-center justify-between gap-3 nesmi-secondary-body"
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
                <h4 className="nesmi-secondary-title mb-2">
                  Due Today/Tomorrow
                </h4>
                <div className="space-y-1">
                  {upcomingChores.slice(0, 5).map((chore) => (
                    <div
                      key={chore.id}
                      className="nesmi-secondary-body text-content-secondary flex items-center gap-2"
                    >
                      <span className="nesmi-planning-dot w-2 h-2 rounded-full shrink-0"></span>
                      {chore.title}
                    </div>
                  ))}
                  {upcomingChores.length > 5 && (
                    <p className="nesmi-secondary-support">
                      +{upcomingChores.length - 5} more
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Suggested Assignee */}
            {suggestedMember && (
              <div className="nesmi-planning-suggestion">
                <p className="nesmi-secondary-body">
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
                className="chore-button primary w-full"
              >
                {isAutoAssigning ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
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
        </Dialog>
      )}

      {/* Chat Assistant */}
      {isChatOpen && <ChatAssistant onClose={() => {setIsChatOpen(false); if(initialOpen)setIsOpen(true);}} />}
    </>
  );
}
