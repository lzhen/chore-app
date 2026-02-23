import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  ChatMessage,
  parseUserInput,
  generateResponse,
  generateId,
  findChore,
} from '../utils/chatAgent';

interface ChatAssistantProps {
  onClose: () => void;
}

export function ChatAssistant({ onClose }: ChatAssistantProps) {
  const { state, addChore, updateChore, completeChore } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hi! I'm your chore assistant. I can help you add, complete, and manage chores. Try saying \"help\" to see what I can do!",
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
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleQuickAction = (action: string) => {
    if (action.endsWith(' ')) {
      // This is a prompt that needs user input
      setInput(action);
      inputRef.current?.focus();
    } else {
      // Execute directly
      setInput(action);
      setTimeout(() => {
        const form = inputRef.current?.closest('form');
        if (form) {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      }, 100);
    }
  };

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
    const context = {
      chores: state.chores,
      teamMembers: state.teamMembers,
      completions: state.completions,
    };
    const response = generateResponse(action, context);

    // Execute actions
    if (action.type === 'add_chore' && action.data) {
      const member = state.teamMembers.find(
        (m) => m.name.toLowerCase() === action.data?.assigneeName?.toLowerCase()
      );

      try {
        await addChore({
          title: action.data.title!,
          date: action.data.date!,
          dueTime: action.data.time || undefined,
          assigneeId: member?.id || null,
          recurrence: action.data.recurrence || 'none',
          priority: action.data.priority || 'medium',
        });

        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: `Done! "${action.data.title}" has been added to the calendar.`,
          timestamp: new Date(),
          quickActions: [
            { label: 'Add another', action: 'add a chore called ' },
            { label: 'Show chores', action: 'show my chores' },
          ],
        };

        setTimeout(() => {
          setMessages((prev) => [...prev, assistantMessage]);
          setIsProcessing(false);
        }, 500);
      } catch {
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: 'Sorry, there was an error adding the chore. Please try again.',
          timestamp: new Date(),
        };

        setTimeout(() => {
          setMessages((prev) => [...prev, errorMessage]);
          setIsProcessing(false);
        }, 500);
      }
    } else if (action.type === 'complete_chore' && action.data) {
      const chore = findChore(action.data.title!, state.chores);

      if (chore) {
        // Find the first team member to use as completer (or use unassigned)
        const completerId = chore.assigneeId || state.teamMembers[0]?.id;

        if (completerId) {
          try {
            const today = new Date().toISOString().split('T')[0];
            await completeChore(chore.id, today, completerId);

            const assistantMessage: ChatMessage = {
              id: generateId(),
              role: 'assistant',
              content: `Great job! "${chore.title}" has been marked as complete. 🎉`,
              timestamp: new Date(),
              quickActions: [
                { label: 'Show chores', action: 'show my chores' },
                { label: 'My stats', action: 'show my stats' },
              ],
            };

            setTimeout(() => {
              setMessages((prev) => [...prev, assistantMessage]);
              setIsProcessing(false);
            }, 500);
          } catch {
            const errorMessage: ChatMessage = {
              id: generateId(),
              role: 'assistant',
              content: 'Sorry, there was an error completing the chore. Please try again.',
              timestamp: new Date(),
            };

            setTimeout(() => {
              setMessages((prev) => [...prev, errorMessage]);
              setIsProcessing(false);
            }, 500);
          }
        } else {
          const errorMessage: ChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: 'No team members available to complete this chore. Please add team members first.',
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
          content: response.text,
          timestamp: new Date(),
          quickActions: response.quickActions,
        };

        setTimeout(() => {
          setMessages((prev) => [...prev, assistantMessage]);
          setIsProcessing(false);
        }, 300);
      }
    } else if (action.type === 'assign_chore' && action.data) {
      const chore = findChore(action.data.title!, state.chores);
      const member = state.teamMembers.find(
        (m) => m.name.toLowerCase() === action.data?.assigneeName?.toLowerCase()
      );

      if (chore && member) {
        try {
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
        } catch {
          const errorMessage: ChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: 'Sorry, there was an error assigning the chore. Please try again.',
            timestamp: new Date(),
          };

          setTimeout(() => {
            setMessages((prev) => [...prev, errorMessage]);
            setIsProcessing(false);
          }, 500);
        }
      } else {
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: chore
            ? `Couldn't find team member "${action.data.assigneeName}". Available: ${state.teamMembers.map((m) => m.name).join(', ')}`
            : `Couldn't find a chore matching "${action.data.title}".`,
          timestamp: new Date(),
          quickActions: [{ label: 'Show chores', action: 'show my chores' }],
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
        content: response.text,
        timestamp: new Date(),
        quickActions: response.quickActions,
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
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">AI</span>
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
          <div key={message.id}>
            <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-4 py-2 rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-accent text-white rounded-br-md'
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
                    className="text-xs px-3 py-1.5 bg-accent/10 text-accent hover:bg-accent/20 rounded-full transition-colors"
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
