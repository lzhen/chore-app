import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  ChatMessage,
  parseUserInput,
  generateResponse,
  generateId,
} from '../utils/chatAgent';

interface ChatAssistantProps {
  onClose: () => void;
}

export function ChatAssistant({ onClose }: ChatAssistantProps) {
  const { state, addChore, updateChore } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hi! I can help you manage chores. Try saying "Add a chore called Clean kitchen tomorrow" or type "help" to see what I can do.',
      timestamp: new Date(),
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
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    // Parse the user input
    const action = parseUserInput(userMessage.content, state.teamMembers);
    const response = generateResponse(action, state.chores, state.teamMembers);

    // Execute actions
    if (action.type === 'add_chore' && action.data) {
      const member = state.teamMembers.find(
        (m) => m.name.toLowerCase() === action.data?.assigneeName?.toLowerCase()
      );

      await addChore({
        title: action.data.title!,
        date: action.data.date!,
        assigneeId: member?.id || null,
        recurrence: action.data.recurrence || 'none',
        priority: 'medium',
      });

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: `Done! "${action.data.title}" has been added to the calendar.`,
        timestamp: new Date(),
      };

      setTimeout(() => {
        setMessages((prev) => [...prev, assistantMessage]);
        setIsProcessing(false);
      }, 500);
    } else if (action.type === 'assign_chore' && action.data) {
      const chore = state.chores.find((c) =>
        c.title.toLowerCase().includes(action.data!.title!.toLowerCase())
      );
      const member = state.teamMembers.find(
        (m) => m.name.toLowerCase() === action.data?.assigneeName?.toLowerCase()
      );

      if (chore && member) {
        await updateChore({ ...chore, assigneeId: member.id });

        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: `Done! "${chore.title}" has been assigned to ${member.name}.`,
          timestamp: new Date(),
        };

        setTimeout(() => {
          setMessages((prev) => [...prev, assistantMessage]);
          setIsProcessing(false);
        }, 500);
      } else {
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: chore
            ? `Couldn't find team member "${action.data.assigneeName}".`
            : `Couldn't find a chore matching "${action.data.title}".`,
          timestamp: new Date(),
        };

        setTimeout(() => {
          setMessages((prev) => [...prev, errorMessage]);
          setIsProcessing(false);
        }, 500);
      }
    } else {
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setTimeout(() => {
        setMessages((prev) => [...prev, assistantMessage]);
        setIsProcessing(false);
      }, 300);
    }
  };

  return (
    <div className="fixed inset-2 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-96 sm:h-[500px] fluent-card z-50 flex flex-col overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
          <span className="font-semibold">Chore Assistant</span>
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-accent text-white'
                  : 'bg-surface-tertiary text-content-primary'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-surface-tertiary px-4 py-2 rounded-lg">
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

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border flex-shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-border rounded-full bg-surface-primary text-content-primary placeholder-content-secondary focus:outline-none focus:ring-2 focus:ring-accent"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="w-10 h-10 bg-accent text-white rounded-full flex items-center justify-center hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
