import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import { useApp } from '../context/AppContext';
import {
  getNotificationState,
  requestNotificationAccess,
  type NotificationState,
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

function useHouseholdTools(){
 const {state}=useApp();
  const [notificationState, setNotificationState] = useState<NotificationState>(getNotificationState);
  const [requestingNotifications, setRequestingNotifications] = useState(false);
  const notificationsEnabled = notificationState === 'granted';
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [googleSignedIn, setGoogleSignedIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: number; failed: number } | null>(null);

  // Recheck after returning from browser site settings, without requesting access.
  useEffect(() => {
    const refresh = () => setNotificationState(getNotificationState());
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
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
      try {
        if (checkAndNotifyUpcomingChores(state.chores, state.teamMembers) === false) setNotificationState('error');
      } catch {
        setNotificationState('error');
      }
    }
  }, [notificationsEnabled, state.chores, state.teamMembers]);

  const handleEnableNotifications = async () => {
    setRequestingNotifications(true);
    try {
      // Call before any await so the browser receives the direct click gesture.
      setNotificationState(await requestNotificationAccess());
    } catch {
      setNotificationState('error');
    } finally {
      setRequestingNotifications(false);
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

 return {state,notificationState,requestingNotifications,notificationsEnabled,googleConfigured,googleSignedIn,isSyncing,syncResult,handleEnableNotifications,handleGoogleSignIn,handleGoogleSignOut,handleSyncToGoogle};
}
const ToolsContext=createContext<ReturnType<typeof useHouseholdTools>|null>(null);
export function HouseholdToolsProvider({children}:{children:ReactNode}){const value=useHouseholdTools();return <ToolsContext.Provider value={value}>{children}</ToolsContext.Provider>;}
const notificationMessages: Record<NotificationState, string> = {
 default: 'Allow reminders while Nesmi is open.',
 granted: 'Permission allowed. Keep Nesmi open for reminders; system settings may silence them.',
 denied: 'Notifications are blocked. Allow them in this browser’s site settings, then check again.',
 dismissed: 'Permission was not allowed. Try again and choose Allow in the browser prompt.',
 unsupported: 'Not supported in this browser.',
 insecure: 'Reminders require HTTPS. Open https://empathie.ai/nesmi/ and try again.',
 native: 'Not available in this app version.',
 error: 'Could not enable reminders. Check browser and system notification settings, then try again.',
};
export function AccountTools(){
 const tools=useContext(ToolsContext);
 if(!tools)return null;
 const {state,notificationState,requestingNotifications,notificationsEnabled,googleConfigured,googleSignedIn,isSyncing,syncResult,handleEnableNotifications,handleGoogleSignIn,handleGoogleSignOut,handleSyncToGoogle}=tools;
 return <div className="nesmi-account-tools">
  <section className="nesmi-settings-section" aria-labelledby="notifications-title">
   <div className="nesmi-settings-row">
    <div><h3 id="notifications-title">Notifications</h3><p id="notification-feedback" role="status">{notificationMessages[notificationState]}</p></div>
    {['native','unsupported','insecure'].includes(notificationState) ? null : notificationsEnabled ? <span className="nesmi-settings-status">Allowed</span> :
     <button type="button" className="chore-button secondary" onClick={handleEnableNotifications} disabled={requestingNotifications} aria-describedby="notification-feedback">
      {requestingNotifications ? 'Waiting for permission…' : notificationState === 'default' ? 'Enable Reminders' : notificationState === 'dismissed' || notificationState === 'error' ? 'Try again' : 'Check again'}
     </button>}
   </div>
  </section>
  <section className="nesmi-settings-section" aria-labelledby="google-title"><div className="nesmi-settings-row"><div><h3 id="google-title">Google Calendar</h3><p>{!googleConfigured?'Calendar connection is not configured.':googleSignedIn?'Connected. Choose when to sync your household chores.':'Connect your calendar to sync household chores.'}</p></div>{googleConfigured&&!googleSignedIn&&<button className="chore-button secondary" onClick={handleGoogleSignIn}>Connect Google Calendar</button>}</div>{googleConfigured&&googleSignedIn&&<div className="nesmi-settings-actions"><button className="chore-button secondary" onClick={handleSyncToGoogle} disabled={isSyncing||state.chores.length===0}>{isSyncing?'Syncing…':'Sync to Google Calendar'}</button><button className="chore-button secondary" onClick={handleGoogleSignOut}>Disconnect</button>{syncResult&&<p role="status">Synced {syncResult.success} chores{syncResult.failed>0?`; ${syncResult.failed} failed`:''}</p>}</div>}</section>

 </div>;
}
