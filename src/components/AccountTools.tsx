import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
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

function useHouseholdTools(){
 const {state,updateChore}=useApp();
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

 return {state,isAutoAssigning,notificationsEnabled,googleConfigured,googleSignedIn,isSyncing,syncResult,analysis,upcomingChores,unassignedCount,suggestedMember,handleAutoAssign,handleEnableNotifications,handleGoogleSignIn,handleGoogleSignOut,handleSyncToGoogle};
}
const ToolsContext=createContext<ReturnType<typeof useHouseholdTools>|null>(null);
export function HouseholdToolsProvider({children}:{children:ReactNode}){const value=useHouseholdTools();return <ToolsContext.Provider value={value}>{children}</ToolsContext.Provider>;}
export function AccountTools(){
 const tools=useContext(ToolsContext);
 if(!tools)return null;
 const {state,isAutoAssigning,notificationsEnabled,googleConfigured,googleSignedIn,isSyncing,syncResult,analysis,upcomingChores,unassignedCount,suggestedMember,handleAutoAssign,handleEnableNotifications,handleGoogleSignIn,handleGoogleSignOut,handleSyncToGoogle}=tools;
 return <div className="nesmi-account-tools">
  <section className="nesmi-settings-section" aria-labelledby="notifications-title"><div className="nesmi-settings-row"><div><h3 id="notifications-title">Notifications</h3><p>{notificationsEnabled?'Reminders are enabled on this device.':'Get reminders for upcoming chores on this device.'}</p></div>{notificationsEnabled?<span className="nesmi-settings-status">Enabled</span>:<button className="chore-button secondary" onClick={handleEnableNotifications}>Enable Reminders</button>}</div></section>
  <section className="nesmi-settings-section" aria-labelledby="google-title"><div className="nesmi-settings-row"><div><h3 id="google-title">Google Calendar</h3><p>{!googleConfigured?'Calendar connection is not configured.':googleSignedIn?'Connected. Choose when to sync your household chores.':'Connect your calendar to sync household chores.'}</p></div>{googleConfigured&&!googleSignedIn&&<button className="chore-button secondary" onClick={handleGoogleSignIn}>Connect Google Calendar</button>}</div>{googleConfigured&&googleSignedIn&&<div className="nesmi-settings-actions"><button className="chore-button secondary" onClick={handleSyncToGoogle} disabled={isSyncing||state.chores.length===0}>{isSyncing?'Syncing…':'Sync to Google Calendar'}</button><button className="chore-button secondary" onClick={handleGoogleSignOut}>Disconnect</button>{syncResult&&<p role="status">Synced {syncResult.success} chores{syncResult.failed>0?`; ${syncResult.failed} failed`:''}</p>}</div>}</section>
  <details className="nesmi-settings-section nesmi-workload"><summary><span><strong>Workload Balance</strong><span className="nesmi-settings-description">{analysis.isBalanced?'Workload is balanced':'Review your household’s workload'} · View details</span></span></summary><div className="nesmi-workload-details">
   {analysis.suggestions.map((suggestion,i)=><p key={i}>{suggestion}</p>)}
   <h4>Team Stats (Last 7 Days)</h4>{analysis.stats.length? <dl>{analysis.stats.map(stat=><div key={stat.memberId}><dt>{stat.memberName}</dt><dd>{stat.recentAssignments} chores</dd></div>)}</dl>:<p>No household activity yet.</p>}
   {upcomingChores.length>0&&<><h4>Due Today/Tomorrow</h4><ul>{upcomingChores.slice(0,3).map(chore=><li key={chore.id}>{chore.title}</li>)}</ul></>}
   {suggestedMember&&<p>Suggestion: Assign the next chore to {suggestedMember.name} (least busy).</p>}
   {unassignedCount>0&&state.teamMembers.length>0&&<button className="chore-button secondary" onClick={handleAutoAssign} disabled={isAutoAssigning}>{isAutoAssigning?'Assigning…':`Auto-Assign ${unassignedCount} Chore${unassignedCount!==1?'s':''}`}</button>}
  </div></details>
 </div>;
}
