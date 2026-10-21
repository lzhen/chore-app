import { dateKey, shiftDate, parseDate as parseCalendarDate } from './dates';
import { generateChoreInstances } from './recurrence';
import { Chore, TeamMember, RecurrenceType, Priority, ChoreCompletion } from '../types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  quickActions?: QuickAction[];
}

export interface QuickAction {
  label: string;
  action: string;
}

export interface ChatAction {
  type:
    | 'add_chore'
    | 'assign_chore'
    | 'complete_chore'
    | 'delete_chore'
    | 'list_chores'
    | 'list_members'
    | 'show_stats'
    | 'show_overdue'
    | 'help'
    | 'greeting'
    | 'choose_date'
    | 'choose_title'
    | 'unknown';
  data?: {
    title?: string;
    date?: string;
    time?: string;
    assigneeName?: string;
    recurrence?: RecurrenceType;
    priority?: Priority;
    memberId?: string;
  };
}

export interface ChatContext {
  chores: Chore[];
  teamMembers: TeamMember[];
  completions: ChoreCompletion[];
}

/**
 * Parse a date string from natural language
 */
export function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(parseCalendarDate(value)) === value;
}
function parseDate(text: string): string | null {
  const value = text.trim().toLowerCase();
  const today = dateKey();
  if (value === 'today') return today;
  if (value === 'tomorrow') return shiftDate(today, 1);
  if (value === 'next week') return shiftDate(today, 7);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return isValidDate(value) ? value : null;
  // Other formats can be ambiguous. Calendar provides an explicit date picker.
  return null;
}

/**
 * Find a team member by name (fuzzy match)
 */
export function findMembers(name: string, members: TeamMember[]): TeamMember[] {
  const query = name.trim().toLowerCase();
  if (!query) return [];
  const exact = members.filter(m => m.name.trim().toLowerCase() === query);
  return exact.length ? exact : members.filter(m => m.name.toLowerCase().includes(query));
}

/**
 * Find a chore by title (fuzzy match)
 */
export function findChores(title: string, chores: Chore[]): Chore[] {
  const query = title.toLowerCase().trim();
  if (!query) return [];
  const exact = chores.filter(c => c.title.toLowerCase().trim() === query);
  if (exact.length) return exact;
  const contains = chores.filter(c => c.title.toLowerCase().includes(query));
  return contains;
}
function findChore(title: string, chores: Chore[]): Chore | null {
  const matches = findChores(title, chores);
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Parse user input to determine intent
 */
export function parseUserInput(input: string, _teamMembers: TeamMember[]): ChatAction {
  const lowerInput = input.toLowerCase().trim();

  if (/\b(don['’]?t|do not|never|cancel|stop|not now|nevermind|never mind)\b/i.test(input)) return {type:'unknown'};

  // Greetings
  if (
    lowerInput.match(/^(hi|hello|hey|good morning|good afternoon|good evening|howdy|yo)(\s|!|$)/i)
  ) {
    return { type: 'greeting' };
  }

  // Help command
  if (lowerInput === 'help' || lowerInput === '?' || lowerInput.includes('what can you do')) {
    return { type: 'help' };
  }

  // Stats/Summary queries
  if (
    lowerInput.includes('my stats') ||
    lowerInput.includes('my progress') ||
    lowerInput.includes('how am i doing') ||
    lowerInput.includes('summary') ||
    lowerInput.includes('dashboard')
  ) {
    return { type: 'show_stats' };
  }

  // Overdue chores
  if (lowerInput.includes('overdue') || lowerInput.includes('past due') || lowerInput.includes('missed')) {
    return { type: 'show_overdue' };
  }

  // List chores
  if (
    lowerInput.includes('list chores') ||
    lowerInput.includes('show chores') ||
    lowerInput.includes('my chores') ||
    lowerInput.includes('upcoming chores') ||
    lowerInput.includes("what's due") ||
    lowerInput.includes('what is due') ||
    lowerInput.includes('what do i have')
  ) {
    return { type: 'list_chores' };
  }

  // List team members
  if (
    lowerInput.includes('list team') ||
    lowerInput.includes('show team') ||
    lowerInput.includes('who is on') ||
    lowerInput.includes('team members')
  ) {
    return { type: 'list_members' };
  }

  const complete = input.trim().match(/^(?:complete|finish|done|mark as done|mark complete|check off)\s+(.+)$/i);
  if (complete) {
    const title = complete[1].trim();
    if (/\b(today|yesterday|tomorrow|last|next|on|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)\b|\d+[/-]\d+|\b\d+ days?\b/i.test(title)) return {type: 'choose_date'};
    return {type: 'complete_chore', data: {title}};
  }
  const assignment = input.trim().match(/^(?:assign|give)\s+(.+?)\s+to\s+(.+)$/i);
  if (assignment) return {type: 'assign_chore', data: {title: assignment[1].trim(), assigneeName: assignment[2].trim()}};
  // A quick-action starter is not a title. Guard before the optional
  // called/named group can backtrack and treat that word as the chore name.
  if (/^(?:add|create|new)\s+(?:a\s+)?(?:chore|task)(?:\s+(?:called|named))?[\s:]*$/i.test(input.trim())) {
    return {type: 'choose_title'};
  }
  const creation = input.trim().match(/^(?:add|create|new) (?:a )?(?:chore|task)(?: called| named)?[ :]+(.+)$/i);
  if (creation) {
    let title = creation[1].trim();
    let assigneeName: string | undefined;
    const assignee = title.match(/^(.*?)\s+assigned to\s+(.+)$/i);
    if (assignee) {title = assignee[1].trim(); assigneeName = assignee[2].trim();}
    let date = dateKey();
    const dated = title.match(/^(.*?)\s+(?:on|for|due)\s+(.+)$/i);
    if (dated) {
      title = dated[1].trim();
      const parsed = parseDate(dated[2]);
      if (!parsed) return {type:'choose_date'};
      date = parsed;
    } else if (/\b(today|tomorrow|yesterday|next|weekly|daily|monthly|every|at)\b|\d+[/-]\d+/i.test(title)) {
      return {type:'choose_date'};
    }
    if (!title) return {type:'unknown'};
    return {type:'add_chore',data:{title,date,assigneeName,recurrence:'none',priority:'medium'}};
  }
  if (/^(?:delete|remove)\s+.+$/i.test(input.trim())) return {type:'delete_chore',data:{title:input.trim().replace(/^\S+\s+/,'')}};

  return { type: 'unknown' };
}

/**
 * Generate a response based on the parsed action
 */
export function generateResponse(
  action: ChatAction,
  context: ChatContext
): { text: string; quickActions?: QuickAction[] } {
  const { chores, teamMembers, completions } = context;

  switch (action.type) {
    case 'greeting':
      const greetings = [
        "Hello! I'm your chore assistant. How can I help you today?",
        "Hi there! Ready to help you manage your chores.",
        "Hey! What can I help you with?",
      ];
      return {
        text: greetings[Math.floor(Math.random() * greetings.length)],
        quickActions: [
          { label: 'Add a chore', action: 'add a chore called ' },
          { label: 'Show chores', action: 'show my chores' },
          { label: 'My stats', action: 'show my stats' },
        ],
      };

    case 'help':
      return {
        text: `Commands in English:
• Add a chore called Dishes on 2026-10-23
• Add a chore called Dishes assigned to Alex
• Complete Dishes
• Assign Dishes to Alex
• Show my chores
• Show my stats

Dates: today, tomorrow, next week or YYYY-MM-DD. Use Calendar for other dates, repeats or times. Completion applies to today's recurring occurrence or the scheduled one-off date.`,
        quickActions: [
          { label: 'Add a chore', action: 'add a chore called ' },
          { label: 'Show chores', action: 'show my chores' },
          { label: 'Show overdue', action: "what's overdue" },
        ],
      };

    case 'show_stats': {
      const today = dateKey();
      const weekAgo = shiftDate(today, -6);

      const totalChores = chores.length;
      const completedThisWeek = completions.filter((c) => c.instanceDate >= weekAgo && c.instanceDate <= today).length;
      const pending = generateChoreInstances(chores, teamMembers, completions, parseCalendarDate(today), parseCalendarDate(today)).filter(i => !i.isCompleted).length;
      const overdue = chores.filter(
        (c) =>
          c.date < today &&
          c.recurrence === 'none' &&
          !completions.some((comp) => comp.choreId === c.id && comp.instanceDate === c.date)
      ).length;

      // Get top performer
      const memberCompletions = teamMembers.map((m) => ({
        name: m.name,
        count: completions.filter((c) => c.completedBy === m.id && c.instanceDate >= weekAgo && c.instanceDate <= today).length,
        points: m.points || 0,
      }));
      const topPerformer = memberCompletions.sort((a, b) => b.count - a.count)[0];

      let statsText = `Last 7 days:\n\n`;
      statsText += `- Total chores: ${totalChores}\n`;
      statsText += `- Completed: ${completedThisWeek}\n`;
      statsText += `- Pending today: ${pending}\n`;
      if (overdue > 0) {
        statsText += `- **Overdue one-off chores: ${overdue}** ⚠️\n`;
      }
      if (topPerformer && topPerformer.count > 0) {
        statsText += `\n🏆 Top performer: ${topPerformer.name} (${topPerformer.count} completed, ${topPerformer.points} pts)`;
      }

      return {
        text: statsText,
        quickActions: overdue > 0 ? [{ label: 'Show overdue', action: "what's overdue" }] : undefined,
      };
    }

    case 'show_overdue': {
      const today = dateKey();
      const overdueChores = chores.filter(
        (c) =>
          c.date < today &&
          c.recurrence === 'none' &&
          !completions.some((comp) => comp.choreId === c.id && comp.instanceDate === c.date)
      );

      if (overdueChores.length === 0) {
        return { text: "No overdue one-off chores." };
      }

      const list = overdueChores
        .slice(0, 5)
        .map((c) => {
          const assignee = teamMembers.find((m) => m.id === c.assigneeId);
          return `- ${c.title} (due ${formatDate(c.date)})${assignee ? ` - ${assignee.name}` : ''}`;
        })
        .join('\n');

      return {
        text: `⚠️ **Overdue one-off chores (${overdueChores.length}):**\n\n${list}${overdueChores.length > 5 ? `\n\n...and ${overdueChores.length - 5} more` : ''}`,
        quickActions: [
          { label: 'Complete first', action: `complete ${overdueChores[0].title}` },
        ],
      };
    }

    case 'list_chores': {
      const today = dateKey();
      const upcoming = generateChoreInstances(chores, teamMembers, completions, parseCalendarDate(today), parseCalendarDate(shiftDate(today, 6)))
        .filter(i => !i.isCompleted)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 7);

      if (upcoming.length === 0) {
        return {
          text: 'No pending occurrences in the next 7 days.',
          quickActions: [{ label: 'Add a chore', action: 'add a chore called ' }],
        };
      }

      const choreList = upcoming
        .map((c) => {
          const assignee = teamMembers.find((m) => m.id === c.assigneeId);
          const assigneeText = assignee ? ` (${assignee.name})` : '';
          const priorityIcon = c.priority === 'high' ? ' 🔴' : c.priority === 'low' ? ' 🟢' : '';
          const timeText = c.dueTime ? ` at ${c.dueTime}` : '';
          return `- ${c.title}${priorityIcon} - ${formatDate(c.date)}${timeText}${assigneeText}`;
        })
        .join('\n');

      return {
        text: `Next 7 days · up to 7 pending occurrences:\n\n${choreList}`,
        quickActions: [
          { label: 'Add more', action: 'add a chore called ' },
          { label: 'Complete one', action: 'complete ' },
        ],
      };
    }

    case 'list_members': {
      if (teamMembers.length === 0) {
        return { text: 'No team members yet. Add some from the sidebar!' };
      }

      const memberList = teamMembers
        .map((m) => {
          const assignedCount = chores.filter((c) => c.assigneeId === m.id).length;
          return `- ${m.name} (${m.points || 0} pts, ${assignedCount} assigned)`;
        })
        .join('\n');

      return { text: `**Team members:**\n\n${memberList}` };
    }

    case 'add_chore': {
      const data = action.data!;
      let response = `I'll add "${data.title}"`;

      if (data.date) {
        response += ` for ${formatDate(data.date)}`;
      }

      if (data.time) {
        response += ` at ${data.time}`;
      }

      if (data.recurrence && data.recurrence !== 'none') {
        response += ` (${data.recurrence})`;
      }

      if (data.priority && data.priority !== 'medium') {
        response += ` [${data.priority} priority]`;
      }

      if (data.assigneeName) {
        response += ` assigned to ${data.assigneeName}`;
      }

      return { text: response + '. Creating it now...' };
    }

    case 'complete_chore': {
      const data = action.data!;
      const chore = findChore(data.title!, chores);
      if (!chore) {
        return {
          text: `I couldn't find a chore matching "${data.title}". Try "show my chores" to see available ones.`,
          quickActions: [{ label: 'Show chores', action: 'show my chores' }],
        };
      }
      return { text: `Marking "${chore.title}" as complete...` };
    }

    case 'delete_chore': {
      const data = action.data!;
      const chore = findChore(data.title!, chores);
      if (!chore) {
        return {
          text: `I couldn't find a chore matching "${data.title}". Try "show my chores" to see available ones.`,
          quickActions: [{ label: 'Show chores', action: 'show my chores' }],
        };
      }
      return { text: `I'll delete "${chore.title}". Please confirm this action from the calendar.` };
    }

    case 'assign_chore': {
      const data = action.data!;
      if (!data.assigneeName) {
        return {
          text: `I couldn't find that team member. Available members: ${teamMembers.map((m) => m.name).join(', ')}`,
        };
      }
      return { text: `Assigning "${data.title}" to ${data.assigneeName}...` };
    }

    case 'choose_date':
      return {text: 'Choose a date in Calendar. No changes made.'};
    case 'choose_title':
      return {text: 'Please add a chore name, for example: add a chore called Wash dishes. No changes made.'};
    case 'unknown':
    default:
      return {
        text: `No changes made. Type “help” for supported commands.`,
        quickActions: [
          { label: 'Help', action: 'help' },
          { label: 'Add a chore', action: 'add a chore called ' },
        ],
      };
  }
}

/**
 * Format a date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const tomorrow = parseCalendarDate(shiftDate(dateKey(today), 1));

  if (dateStr === dateKey(today)) {
    return 'today';
  }

  if (dateStr === dateKey(tomorrow)) {
    return 'tomorrow';
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Find a chore by title (exported for use in ChatAssistant)
 */
export { findChore };
