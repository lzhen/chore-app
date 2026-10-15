import '../styles/nesmi-secondary-surfaces.css';
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  analyzeWorkloadBalance,
  getUpcomingChores,
} from '../utils/schedulingAgent';
import { Dialog } from './Dialog';
import { ChatAssistant } from './ChatAssistant';

export function AgentPanel({initialOpen=false,onDismiss,onChatOpen,onSettingsOpen,onWorkloadOpen}:{initialOpen?:boolean;onDismiss?:()=>void;onChatOpen?:()=>void;onSettingsOpen?:()=>void;onWorkloadOpen?:()=>void}={}) {
  const { state } = useApp();
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const analysis = analyzeWorkloadBalance(state.chores, state.teamMembers);
  const upcomingChores = getUpcomingChores(state.chores);
  const unassignedCount = state.chores.filter((c) => !c.assigneeId).length;

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
        <Dialog title="Planning tools" variant="dialog" onClose={()=>{setIsOpen(false);onDismiss?.();}}>
          <div className="nesmi-agent-content nesmi-secondary-surface space-y-4">
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

            {onSettingsOpen&&<button className="chore-button secondary w-full" onClick={onSettingsOpen}>Notifications &amp; Google Calendar <span aria-hidden="true">›</span></button>}
            {onWorkloadOpen&&<button className="chore-button secondary w-full" onClick={onWorkloadOpen}>Workload in Insights <span aria-hidden="true">›</span></button>}
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


          </div>
        </Dialog>
      )}

      {/* Chat Assistant */}
      {isChatOpen && <ChatAssistant onClose={() => {setIsChatOpen(false); if(initialOpen)setIsOpen(true);}} />}
    </>
  );
}
