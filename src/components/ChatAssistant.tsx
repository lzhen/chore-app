import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  ChatMessage,
  parseUserInput,
  generateResponse,
  generateId,
  findChores,
  findMembers,
  isValidDate,
  type ChatAction,
} from '../utils/chatAgent';

import { dateKey, parseDate } from '../utils/dates';
import { generateChoreInstances } from '../utils/recurrence';
import type { Chore } from '../types';

interface ChatAssistantProps {
  active: boolean;
}

export function ChatAssistant({ active }: ChatAssistantProps) {
  const { state, addChore, updateChore, completeChore } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Task commands in English. Add, assign or complete a chore. Type “help” for examples.',
      timestamp: new Date(),
      quickActions: [
        { label: 'Add a chore', action: 'add a chore called ' },
        { label: 'Show chores', action: 'show my chores' },
        { label: 'Help', action: 'help' },
      ],
    },
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (active) scrollToBottom();
  }, [messages, active]);


  type Pending = { action: ChatAction; choreIds?: string[]; choreId?: string; memberIds?: string[] };
  const [pending, setPending] = useState<Pending | null>(null);
  const busyRef = useRef(false);
  const reply = (content: string, quickActions?: ChatMessage['quickActions']) => {
    setMessages(previous => [...previous, { id: generateId(), role: 'assistant', content, timestamp: new Date(), quickActions }]);
  };

  const runMutation = async (operation: () => Promise<unknown>, success: string) => {
    if (busyRef.current) return;
    busyRef.current = true; setIsProcessing(true); setPending(null);
    try { await operation(); reply(success); }
    catch { reply('Could not save. Try again.'); }
    finally { busyRef.current = false; setIsProcessing(false); inputRef.current?.focus(); }
  };

  const complete = async (chore: Chore, memberId: string) => {
    const instanceDate = chore.recurrence === 'none' ? chore.date : dateKey();
    const occurrence = generateChoreInstances([chore], state.teamMembers, state.completions, parseDate(instanceDate), parseDate(instanceDate))[0];
    if (!occurrence) { setPending(null); reply('No occurrence today. Choose a date in Calendar.'); return; }
    if (instanceDate > dateKey()) { setPending(null); reply('This chore is scheduled for a future date. Open it in Calendar.'); return; }
    if (occurrence.isCompleted) { setPending(null); reply('Already completed.'); return; }
    if (!state.teamMembers.some(member => member.id === memberId)) { setPending(null); reply('Member no longer available. Try again.'); return; }
    await runMutation(() => completeChore(chore.id, instanceDate, memberId), `Completed “${chore.title}” · ${instanceDate}.`);
  };

  const chooseChore = async (action: ChatAction, id: string) => {
    if (busyRef.current) return;
    const chore = state.chores.find(item => item.id === id);
    if (!chore) { setPending(null); reply('Chore no longer available. Try again.'); return; }
    if (action.type === 'complete_chore') {
      // Never invent an attribution for an unassigned or stale member reference.
      if (!chore.assigneeId || !state.teamMembers.some(m => m.id === chore.assigneeId)) {
        if (!state.teamMembers.length) { setPending(null); reply('Add a household member before recording completion.'); return; }
        setPending({action, choreId: id}); reply(`Who completed “${chore.title}”?`); return;
      }
      await complete(chore, chore.assigneeId);
    } else if (action.type === 'assign_chore') {
      const members = findMembers(action.data?.assigneeName || '', state.teamMembers);
      if (!members.length) { setPending(null); reply('No matching member. Choose a member in chore details.'); return; }
      // Require explicit choice even for a unique partial match.
      if (members.length !== 1 || members[0].name.toLowerCase() !== action.data?.assigneeName?.toLowerCase()) {
        setPending({action, choreId:id, memberIds:members.map(m => m.id)}); reply('Choose a member.'); return;
      }
      await runMutation(() => updateChore({...chore, assigneeId: members[0].id}), `Assigned “${chore.title}” to ${members[0].name}.`);
    }
  };

  const add = async (action: ChatAction, memberId?: string) => {
    const data = action.data;
    if (!data?.date || !isValidDate(data.date) || (memberId && !state.teamMembers.some(m => m.id === memberId))) {setPending(null); reply('No changes made. Try again.'); return;}
    await runMutation(() => addChore({title:data.title!, date:data.date!, assigneeId:memberId || null, recurrence:'none', priority:'medium'}), `Added “${data.title}”.`);
  };

  const submit = async (text: string) => {
    if (!text.trim() || busyRef.current) return;
    setPending(null); setInput('');
    setMessages(previous => [...previous, {id: generateId(), role: 'user', content: text.trim(), timestamp: new Date()}]);
    const action = parseUserInput(text.trim(), state.teamMembers);
    if (action.type === 'complete_chore' || action.type === 'assign_chore') {
      const matches = findChores(action.data?.title || '', state.chores);
      if (!matches.length) { reply('No matching chore.'); return; }
      if (matches.length > 1) { setPending({action, choreIds: matches.map(c => c.id)}); reply('Choose a chore.'); return; }
      await chooseChore(action, matches[0].id); return;
    }
    if (action.type === 'add_chore' && action.data) {
      const data = action.data;
      if (!data.date || !isValidDate(data.date)) { reply('Choose a date in Calendar. No changes made.'); return; }
      const members = data.assigneeName ? findMembers(data.assigneeName, state.teamMembers) : [];
      if (data.assigneeName && !members.length) {reply('No matching member. No changes made.'); return;}
      if (data.assigneeName && (members.length !== 1 || members[0].name.toLowerCase() !== data.assigneeName.toLowerCase())) {
        setPending({action,memberIds:members.map(m => m.id)}); reply('Choose a member.'); return;
      }
      await add(action, members[0]?.id);
      return;
    }
    const response = generateResponse(action, {chores: state.chores, teamMembers: state.teamMembers, completions: state.completions});
    reply(response.text, response.quickActions);
  };
  const handleQuickAction = (action: string) => {
    if (action.endsWith(' ')) { setPending(null); setInput(action); inputRef.current?.focus(); }
    else void submit(action);
  };
  const handleSubmit = (event: React.FormEvent) => { event.preventDefault(); void submit(input); };

  return (
    <div className="nesmi-chat-content">
      {/* Messages */}
      <div className="nesmi-chat-messages space-y-4" role="log" aria-label="Conversation" aria-live={active ? "polite" : "off"}>
        {messages.map((message) => (
          <div key={message.id}>
            <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-4 py-2 rounded-2xl ${
                  message.role === 'user'
                    ? 'nesmi-chat-user rounded-br-md'
                    : 'bg-surface-tertiary text-content-primary rounded-bl-md'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
            {/* Quick Actions */}
            {message.role === 'assistant' && message.quickActions && message.quickActions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2 ml-1">
                {message.quickActions.map((qa, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickAction(qa.action)}
                    className="chore-button secondary nesmi-chat-suggestion" disabled={isProcessing}
                  >
                    {qa.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-surface-tertiary px-4 py-2 rounded-2xl rounded-bl-md">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-content-secondary rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-content-secondary rounded-full animate-bounce"
                  style={{ animationDelay: '0.1s' }}
                ></div>
                <div
                  className="w-2 h-2 bg-content-secondary rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}
                ></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {pending && <div className="nesmi-assistant-choices" role="group" aria-label={pending.choreIds ? 'Choose a chore' : pending.action.type === 'complete_chore' ? 'Choose who completed it' : 'Choose a member'}>
        {pending.choreIds?.map(id => {
          const chore = state.chores.find(c => c.id === id);
          if (!chore) return null;
          const member = state.teamMembers.find(m => m.id === chore.assigneeId);
          return <button key={id} className="chore-button secondary" onClick={() => void chooseChore(pending.action, id)} disabled={isProcessing}>{chore.title} · {chore.date} · {member?.name || 'Unassigned'}{chore.recurrence !== 'none' ? ` · ${chore.recurrence}` : ''}{pending.choreIds!.some(otherId => otherId !== id && state.chores.some(other => other.id === otherId && other.title === chore.title && other.date === chore.date && other.assigneeId === chore.assigneeId)) ? ` · ID ${id.slice(-6)}` : ''}</button>;
        })}
        {!pending.choreIds && (pending.choreId || pending.memberIds) && state.teamMembers.filter(m => !pending.memberIds || pending.memberIds.includes(m.id)).map(member => <button key={member.id} className="chore-button secondary" onClick={() => {
          if (pending.action.type === 'add_chore') {void add(pending.action, member.id); return;}
          const chore = state.chores.find(c => c.id === pending.choreId);
          if (!chore) {setPending(null); reply('Chore no longer available. Try again.'); return;}
          if (pending.action.type === 'assign_chore') void runMutation(() => updateChore({...chore, assigneeId: member.id}), `Assigned “${chore.title}” to ${member.name}.`);
          else void complete(chore, member.id);
        }} disabled={isProcessing}>{member.name}{state.teamMembers.filter(m => m.name.toLowerCase() === member.name.toLowerCase()).length > 1 ? ` · Member ${member.id.slice(-6)}` : ''}</button>)}
        <button className="chore-button secondary" onClick={() => {setPending(null); reply('Cancelled.'); inputRef.current?.focus();}}>Cancel selection</button>
      </div>}
      {/* Input */}
      <form onSubmit={handleSubmit} className="nesmi-chat-composer">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter a task command…" aria-label="Message"
            className="nesmi-chat-input"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            aria-label="Send message" className="chore-button primary nesmi-chat-send"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
