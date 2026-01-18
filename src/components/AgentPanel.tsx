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
import { ChatAssistant } from './ChatAssistant';

export function AgentPanel() {
  const { state, updateChore } = useApp();
  const [isOpen, setIsOpen] = useState(false);
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
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-accent hover:bg-accent-hover text-white rounded-full shadow-lg flex items-center justify-center z-40 transition-transform hover:scale-105"
        title="Calendar Agent"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        {(unassignedCount > 0 || !analysis.isBalanced) && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unassignedCount > 0 ? unassignedCount : '!'}
          </span>
        )}
      </button>

      {/* Agent Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-80 glass-card overflow-hidden animate-slide-up z-40">
          <div className="bg-accent text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <span className="font-semibold">Calendar Agent</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
            {/* Chat Assistant Button */}
            <button
              onClick={() => {
                setIsChatOpen(true);
                setIsOpen(false);
              }}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-md font-medium hover:from-purple-600 hover:to-blue-600 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              Chat with Assistant
            </button>

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
                  className="w-full py-2 px-4 bg-surface-tertiary text-content-primary rounded-md text-sm hover:bg-surface-secondary flex items-center justify-center gap-2 transition-colors"
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
                      className="w-full py-2 px-4 bg-accent text-white rounded-md text-sm hover:bg-accent-hover disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
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
                    className="w-full py-2 px-4 bg-surface-tertiary text-content-primary rounded-md text-sm hover:bg-surface-secondary flex items-center justify-center gap-2 transition-colors"
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
      )}

      {/* Chat Assistant */}
      {isChatOpen && <ChatAssistant onClose={() => setIsChatOpen(false)} />}
    </>
  );
}
