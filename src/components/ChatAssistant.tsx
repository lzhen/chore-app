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
  active: boolean;
}

export function ChatAssistant({ active }: ChatAssistantProps) {
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
    if (active) scrollToBottom();
  }, [messages, active]);


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

      {/* Input */}
      <form onSubmit={handleSubmit} className="nesmi-chat-composer">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your chores…" aria-label="Message"
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
