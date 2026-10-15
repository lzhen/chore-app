import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { analyzeWorkloadBalance, suggestAssignee, autoAssignChores } from '../utils/schedulingAgent';
export function WorkloadBalance(){
const {state,updateChore}=useApp();
const [isAutoAssigning,setIsAutoAssigning]=useState(false);
const [error,setError]=useState('');
const unassignedCount=state.chores.filter(c=>!c.assigneeId).length;

const analysis=analyzeWorkloadBalance(state.chores,state.teamMembers);
const suggestedMember=suggestAssignee(state.chores,state.teamMembers);
  const handleAutoAssign = async () => {
    setIsAutoAssigning(true); setError('');
    try {
    const assignments = autoAssignChores(state.chores, state.teamMembers);

    for (const [choreId, memberId] of assignments) {
      const chore = state.chores.find((c) => c.id === choreId);
      if (chore) {
        await updateChore({ ...chore, assigneeId: memberId });
      }
    }

    } catch { setError('Could not finish assigning chores. Your saved assignments are preserved. Try again.'); }
    finally { setIsAutoAssigning(false); }
  };


return <section className="space-y-4 mt-6" aria-label="Workload balance">            {/* Workload Status */}
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
                        {stat.recentAssignments} {stat.recentAssignments===1?'chore':'chores'}
                      </span>
                    </div>
                  ))}
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
            )}{error&&<p role="alert" className="chore-error">{error}</p>}</section>;
}
