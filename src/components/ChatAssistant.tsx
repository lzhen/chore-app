import '../styles/nesmi-secondary-surfaces.css';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ChatMessage, parseUserInput, generateResponse, generateId, findChore } from '../utils/chatAgent';
import { dateKey, parseDate } from '../utils/dates';
import { generateChoreInstances } from '../utils/recurrence';
import type { ChoreInstance } from '../types';
import { ChatPanel } from './ChatPanel';
import { ChoreModal, type ChoreDefaultValues } from './ChoreModal';
import { CompletionDialog } from './CompletionDialog';

interface ChatAssistantProps {
  onClose: () => void;
  open?: boolean;
  suspended?: boolean;
}

export function ChatAssistant({ onClose, open=true, suspended=false }: ChatAssistantProps) {
  const { state, updateChore } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: 'welcome', role: 'assistant', timestamp: new Date(),
    content: 'View household chores or add one with a simple command. New chores open for review. Assignment commands save immediately.',
    quickActions: [
      { label: 'Add a chore', action: 'add a chore called ' },
      { label: 'Show chores', action: 'show chores' },
      { label: 'Help', action: 'help' },
    ],
  }]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [draft, setDraft] = useState<ChoreDefaultValues | null>(null);
  const [completion, setCompletion] = useState<ChoreInstance | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  }, [messages, draft, completion]);

  function reply(content: string, quickActions?: ChatMessage['quickActions']) {
    setMessages(previous => [...previous, { id: generateId(), role: 'assistant', content, timestamp: new Date(), quickActions }]);
  }

  async function submit(value: string) {
    const content = value.trim();
    if (!content || isProcessing) return;
    setMessages(previous => [...previous, { id: generateId(), role: 'user', content, timestamp: new Date() }]);
    setInput('');
    const action = parseUserInput(content, state.teamMembers);
    const response = generateResponse(action, state);

    if (action.type === 'add_chore' && action.data) {
      const member = state.teamMembers.find(m => m.name.toLowerCase() === action.data?.assigneeName?.toLowerCase());
      reply(`Review “${action.data.title}” in the chore form. Nothing is saved until you choose Add chore.`);
      setDraft({
        title: action.data.title, date: action.data.date,
        startTime: action.data.time, assigneeId: member?.id || null,
        recurrence: action.data.recurrence, priority: action.data.priority,
      });
      return;
    }

    if (action.type === 'complete_chore' && action.data) {
      const chore = findChore(action.data.title || '', state.chores);
      if (!chore) { reply(response.text, response.quickActions); return; }
      const today = dateKey();
      const instanceDate = chore.recurrence === 'none' ? chore.date : today;
      const instance = generateChoreInstances([chore], state.teamMembers, state.completions, parseDate(instanceDate), parseDate(instanceDate))[0];
      if (!instance || instanceDate > today) {
        reply(`Open “${chore.title}” from Chores or Calendar to choose the occurrence you want to complete.`);
      } else if (instance.isCompleted) {
        reply(`“${chore.title}” is already complete for ${instanceDate}.`);
      } else {
        reply(`Review the date and choose who completed “${chore.title}”. Nothing is marked done until you confirm.`);
        setCompletion(instance);
      }
      return;
    }

    if (action.type === 'assign_chore' && action.data) {
      const chore = findChore(action.data.title || '', state.chores);
      const member = state.teamMembers.find(m => m.name.toLowerCase() === action.data?.assigneeName?.toLowerCase());
      if (!chore || !member) {
        reply(!chore ? `I couldn't find one unique chore matching “${action.data.title}”. Use the full chore name, or open it from Chores.` : response.text);
        return;
      }
      setIsProcessing(true);
      try {
        await updateChore({ ...chore, assigneeId: member.id });
        reply(`“${chore.title}”${chore.recurrence !== 'none' ? ' and its repeating occurrences' : ''} has been assigned to ${member.name}.`);
      } catch {
        reply('The assignment could not be saved. Please try again.');
      } finally {
        setIsProcessing(false);
      }
      return;
    }
    reply(response.text, response.quickActions);
  }

  function handleQuickAction(action: string) {
    if (isProcessing) return;
    if (action.endsWith(' ')) { setInput(action); inputRef.current?.focus(); }
    else void submit(action);
  }

  return (
    <>
    <ChatPanel open={open} onClose={onClose} busy={isProcessing} suspended={suspended||!!draft||!!completion} footer={        <form onSubmit={event => { event.preventDefault(); void submit(input); }} className="nesmi-chat-composer nesmi-secondary-surface">
          <label className="sr-only" htmlFor="chore-assistant-input">Chore command</label>
          <div className="flex gap-2">
            <input id="chore-assistant-input" ref={inputRef} type="text" value={input} onChange={event => setInput(event.target.value)} placeholder="Try “show chores”" className="nesmi-secondary-field nesmi-chat-command min-w-0 flex-1" disabled={isProcessing} />
            <button type="submit" aria-label="Send command" disabled={!input.trim() || isProcessing} className="chore-button primary nesmi-chat-send shrink-0">
              <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </div>
        </form>}>
        <div className="nesmi-chat-log nesmi-secondary-surface space-y-4" role="log" aria-label="Chore assistant conversation" aria-live="polite">
          {messages.map(message => (
            <div key={message.id}>
              <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <p className={`max-w-[90%] break-words px-4 py-2 nesmi-chat-message rounded-2xl nesmi-secondary-body whitespace-pre-wrap ${message.role === 'user' ? 'nesmi-chat-user rounded-br-md' : 'nesmi-chat-assistant rounded-bl-md'}`}>
                  {message.content}
                </p>
              </div>
              {message.role === 'assistant' && message.quickActions && <div className="flex flex-wrap gap-2 mt-2 ml-1">
                {message.quickActions.map((action, index) => <button key={index} type="button" disabled={isProcessing} onClick={() => handleQuickAction(action.action)} className="chore-button secondary nesmi-chat-quick-action">{action.label}</button>)}
              </div>}
            </div>
          ))}
          {isProcessing && <p className="nesmi-secondary-support" role="status">Saving…</p>}
          <div ref={messagesEndRef} />
        </div>

    </ChatPanel>
    {draft&&<ChoreModal isOpen defaultValues={draft} onClose={() => setDraft(null)} />}
    {completion&&<CompletionDialog instance={completion} onClose={() => setCompletion(null)} />}
    </>
  );
}
