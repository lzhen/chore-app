import '../styles/nesmi-secondary-surfaces.css';
import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
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
  getGoogleAuthorizationMessage,
  signOutFromGoogle,
  syncChoresToGoogleCalendar,
} from '../utils/googleCalendar';

export function IntegrationSettings() {
 const {state}=useApp();
 const previewOnly=(window as Window & {__NESMI_PREVIEW__?:boolean}).__NESMI_PREVIEW__===true;
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [googleSignedIn, setGoogleSignedIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: number; failed: number } | null>(null);

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
      initGoogleApi().then(ready => {
        if(!ready)setGoogleError('Google Calendar could not load. Check your connection and reopen Account settings to retry.');
        setGoogleSignedIn(ready && isGoogleSignedIn());
      });
    }
  }, []);

  // Check for upcoming chores and send notifications
  useEffect(() => {
    if (!previewOnly && notificationsEnabled && state.chores.length > 0) {
      checkAndNotifyUpcomingChores(state.chores, state.teamMembers);
    }
  }, [notificationsEnabled, state.chores, state.teamMembers]);

  const handleEnableNotifications = async () => {
    if (previewOnly) return;
    const granted = await requestNotificationPermission();
    setNotificationsEnabled(granted);
    if (granted) {
      checkAndNotifyUpcomingChores(state.chores, state.teamMembers);
    }
  };

  const [googleError,setGoogleError]=useState('');
  const handleGoogleSignIn = async () => {
    setGoogleError('');
    if (previewOnly) return;
    const success = await signInToGoogle();
    setGoogleSignedIn(success);
    if(!success)setGoogleError(getGoogleAuthorizationMessage());
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

 return <div className="nesmi-integration-settings space-y-6 mt-6 border-t border-border pt-5">            {/* Notifications Toggle */}
            <div>
              <h4 className="nesmi-secondary-title mb-2">
                Notifications
              </h4>
              <p className="nesmi-secondary-support">Checks when you open Account settings. No background reminders.</p>
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

            {googleError&&<p role="alert" className="chore-error">{googleError}</p>}
            {!previewOnly&&!googleConfigured&&<section><h4 className="nesmi-secondary-title">Google Calendar</h4><p className="nesmi-secondary-support">Connection is not available in this version. Your chores remain available here.</p></section>}
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

</div>;
}
