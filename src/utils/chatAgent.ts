import { Chore, TeamMember, RecurrenceType, Priority, ChoreCompletion } from '../types';
import { dateKey, parseDate as parseCalendarDate, shiftDate } from './dates';
import { generateChoreInstances } from './recurrence';

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
function parseDate(text: string): string | null {
  const today = new Date();
  const lowerText = text.toLowerCase();

  if (lowerText.includes('today')) {
    return dateKey(today);
  }

  if (lowerText.includes('tomorrow')) {
    return shiftDate(dateKey(today), 1);
  }

  if (lowerText.includes('next week')) {
    return shiftDate(dateKey(today), 7);
  }

  // "in X days"
  const inDaysMatch = lowerText.match(/in\s+(\d+)\s+days?/);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1]);
    return shiftDate(dateKey(today), days);
  }

  // Try to find day names
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < days.length; i++) {
    if (lowerText.includes(days[i])) {
      const currentDay = today.getDay();
      let daysUntil = i - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      return shiftDate(dateKey(today), daysUntil);
    }
  }

  const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) return dateKey(parseCalendarDate(isoMatch[1])) === isoMatch[1] ? isoMatch[1] : null;

  // Try to parse explicit date formats
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1]);
    const day = parseInt(dateMatch[2]);
    const year = dateMatch[3] ? parseInt(dateMatch[3]) : today.getFullYear();
    const fullYear = year < 100 ? 2000 + year : year;
    const value = `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dateKey(parseCalendarDate(value)) === value ? value : null;
  }

  return null;
}

/**
 * Parse time from natural language
 */
function parseTime(text: string): string | null {
  const lowerText = text.toLowerCase();

  // Match "at X:XX" or "at Xpm/am"
  const timeMatch = lowerText.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const period = timeMatch[3]?.toLowerCase();

    if (minutes > 59 || hours > (period ? 12 : 23) || (period && hours < 1)) return null;

    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  // Match morning/afternoon/evening
  if (lowerText.includes('morning')) return '09:00';
  if (lowerText.includes('noon') || lowerText.includes('lunch')) return '12:00';
  if (lowerText.includes('afternoon')) return '14:00';
  if (lowerText.includes('evening')) return '18:00';
  if (lowerText.includes('night')) return '20:00';

  return null;
}

/**
 * Parse priority from natural language
 */
function parsePriority(text: string): Priority {
  const lowerText = text.toLowerCase();

  if (
    lowerText.includes('high priority') ||
    (lowerText.includes('urgent') && !lowerText.includes('not urgent')) ||
    lowerText.includes('important') ||
    lowerText.includes('asap')
  ) {
    return 'high';
  }

  if (lowerText.includes('low priority') || lowerText.includes('whenever') || lowerText.includes('not urgent')) {
    return 'low';
  }

  return 'medium';
}

/**
 * Parse recurrence from natural language
 */
function parseRecurrence(text: string): RecurrenceType {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('every day') || lowerText.includes('daily')) {
    return 'daily';
  }

  if (lowerText.includes('every week') || lowerText.includes('weekly')) {
    return 'weekly';
  }

  if (lowerText.includes('every month') || lowerText.includes('monthly')) {
    return 'monthly';
  }

  return 'none';
}

/**
 * Find a team member by name (fuzzy match)
 */
function findMember(name: string, teamMembers: TeamMember[]): TeamMember | null {
  const lowerName = name.toLowerCase().trim();

  if (!lowerName) return null;
  const exact = teamMembers.filter(m => m.name.toLowerCase() === lowerName);
  if (exact.length) return exact.length === 1 ? exact[0] : null;
  const matches = teamMembers.filter(m => m.name.toLowerCase().startsWith(lowerName));
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Find a chore by title (fuzzy match)
 */
function findChore(title: string, chores: Chore[]): Chore | null {
  const lowerTitle = title.toLowerCase().trim();

  if (!lowerTitle) return null;
  const exact = chores.filter(c => c.title.toLowerCase() === lowerTitle);
  if (exact.length) return exact.length === 1 ? exact[0] : null;
  const matches = chores.filter(c => c.title.toLowerCase().includes(lowerTitle));
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Parse user input to determine intent
 */
export function parseUserInput(input: string, teamMembers: TeamMember[]): ChatAction {
  const lowerInput = input.toLowerCase().trim();

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
    lowerInput.includes('show stats') ||
    lowerInput.includes('household progress') ||
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

  // Complete chore patterns
  const completePatterns = [
    /^(?:complete|finish|done|mark as done|mark complete|check off)\s+["']?(.+?)["']?$/i,
    /^i(?:'ve| have)? (?:completed|finished|done)\s+["']?(.+?)["']?$/i,
    /^["']?(.+?)["']?\s+is (?:done|complete|finished)$/i,
  ];

  for (const pattern of completePatterns) {
    const match = input.match(pattern);
    if (match) {
      const title = match[1].trim();
      return {
        type: 'complete_chore',
        data: { title },
      };
    }
  }

  // Delete chore patterns
  const deletePatterns = [
    /^(?:delete|remove|cancel)\s+["']?(.+?)["']?$/i,
    /^(?:get rid of|take off)\s+["']?(.+?)["']?$/i,
  ];

  for (const pattern of deletePatterns) {
    const match = input.match(pattern);
    if (match) {
      const title = match[1].trim();
      return {
        type: 'delete_chore',
        data: { title },
      };
    }
  }

  // Add chore patterns
  const addPatterns = [
    /^add (?:a )?(?:chore|task) (?:called |named |for )?["']?([^"']+?)["']?(?:\s+(?:on|for|due)\s+(.+))?$/i,
    /^create (?:a )?(?:chore|task) (?:called |named |for )?["']?([^"']+?)["']?(?:\s+(?:on|for|due)\s+(.+))?$/i,
    /^new (?:chore|task)[:\s]+["']?([^"']+?)["']?(?:\s+(?:on|for|due)\s+(.+))?$/i,
    /^schedule ["']?([^"']+?)["']?(?:\s+(?:on|for|due)\s+(.+))?$/i,
    /^remind me to\s+["']?(.+?)["']?(?:\s+(?:on|for|due)\s+(.+))?$/i,
  ];

  for (const pattern of addPatterns) {
    const match = input.match(pattern);
    if (match) {
      const title = match[1].trim()
        .replace(/\s+\b(today|tomorrow|next week|daily|weekly|monthly|every day|every week|every month)\b/gi, '')
        .replace(/\s+at\s+\d{1,2}(?::\d{2})?\s*(am|pm)?/gi, '').trim();
      if (!title) return { type: 'unknown' };
      const dateContext = match[2] || input;
      const parsedDate = parseDate(dateContext);
      if (match[2] && !parsedDate) return { type: 'unknown' };
      const date = parsedDate || dateKey();
      const time = parseTime(input);
      const recurrence = parseRecurrence(input);
      const priority = parsePriority(input);

      // Check for assignee
      let assigneeName: string | undefined;
      const assignMatch = input.match(/(?:assign(?:ed)? to|for)\s+(\w+)/i);
      if (assignMatch) {
        const member = findMember(assignMatch[1], teamMembers);
        if (member) {
          assigneeName = member.name;
        }
      }

      return {
        type: 'add_chore',
        data: { title, date, time: time || undefined, recurrence, priority, assigneeName },
      };
    }
  }

  // Assign chore pattern
  const assignPatterns = [
    /^assign\s+["']?(.+?)["']?\s+to\s+(.+)$/i,
    /^give\s+["']?(.+?)["']?\s+to\s+(.+)$/i,
    /^(.+?)\s+should\s+(?:do|handle)\s+["']?(.+?)["']?$/i,
  ];

  for (const pattern of assignPatterns) {
    const match = input.match(pattern);
    if (match) {
      let choreTitle, memberName;
      if (pattern.source.includes('should')) {
        memberName = match[1].trim();
        choreTitle = match[2].trim();
      } else {
        choreTitle = match[1].trim();
        memberName = match[2].trim();
      }
      const member = findMember(memberName, teamMembers);

      return {
        type: 'assign_chore',
        data: {
          title: choreTitle,
          assigneeName: member?.name,
        },
      };
    }
  }

  // Unsupported conversation must never create a chore.
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
          { label: 'Show chores', action: 'show chores' },
          { label: 'Household progress', action: 'show stats' },
        ],
      };

    case 'help':
      return {
        text: `Simple commands:

Add a chore (review before saving):
- "Add a chore called Clean kitchen for tomorrow"
- "Add a chore called Water plants for today at 8pm daily"

Manage chores:
- "Complete clean kitchen" opens a date and person check
- "Assign dishes to Alex" saves immediately; repeating chores update the whole series
- Delete chores from their form in Chores or Calendar

View info:
- "Show chores" shows pending household chores in the next 30 days
- "Show stats" shows recent completions, pending today and saved chores
- "What's overdue?" shows one-off chores and the last 30 days of repeats
- "Show team"

These are simple local commands. Unsupported requests won’t change your chores.`,
        quickActions: [
          { label: 'Add a chore', action: 'add a chore called ' },
          { label: 'Show chores', action: 'show chores' },
          { label: 'Show overdue', action: "what's overdue" },
        ],
      };

    case 'show_stats': {
      const today = dateKey();
      const firstDay = shiftDate(today, -6);
      const completed = completions.filter(c => {
        const instant = new Date(c.completedAt);
        return Number.isFinite(instant.getTime()) && dateKey(instant) >= firstDay && dateKey(instant) <= today;
      });
      const pendingToday = generateChoreInstances(chores, teamMembers, completions, parseCalendarDate(today), parseCalendarDate(today)).filter(c => !c.isCompleted).length;
      return { text: `Household progress\n- Done in the last 7 days (including today): ${completed.length}\n- Pending today: ${pendingToday}\n- Saved chores: ${chores.length}` };
    }

    case 'show_overdue': {
      const today = dateKey();
      const from = shiftDate(today, -30);
      const yesterday = shiftDate(today, -1);
      const oneOffs = chores.filter(c => c.recurrence === 'none' && c.date < today);
      const oldest = oneOffs.reduce((first, c) => c.date < first ? c.date : first, from);
      const instances = [
        ...generateChoreInstances(oneOffs, teamMembers, completions, parseCalendarDate(oldest), parseCalendarDate(yesterday)),
        ...generateChoreInstances(chores.filter(c => c.recurrence !== 'none'), teamMembers, completions, parseCalendarDate(from), parseCalendarDate(yesterday)),
      ].filter(c => !c.isCompleted).sort((a, b) => a.date.localeCompare(b.date));
      const scope = 'All past one-off chores; repeating occurrences from the last 30 days. Today is excluded.';
      if (!instances.length) return { text: `No overdue chores in this range. ${scope}` };
      const list = instances.slice(0, 7).map(c => `- ${c.title} (due ${formatDate(c.date)})${c.assigneeName ? ` - ${c.assigneeName}` : ''}`).join('\n');
      return { text: `Overdue occurrences (${instances.length}):\n${scope}\n\n${list}${instances.length > 7 ? `\n… and ${instances.length - 7} more` : ''}\n\nOpen a chore in Chores or Calendar to complete a specific overdue occurrence.` };
    }

    case 'list_chores': {
      const today = dateKey();
      const instances = generateChoreInstances(chores, teamMembers, completions, parseCalendarDate(today), parseCalendarDate(shiftDate(today, 29)))
        .filter(c => !c.isCompleted).sort((a, b) => a.date.localeCompare(b.date) || (a.dueTime || '').localeCompare(b.dueTime || ''));
      if (!instances.length) return {
        text: 'No pending household chores in the next 30 days (including today).',
        quickActions: [{ label: 'Add a chore', action: 'add a chore called ' }],
      };
      const list = instances.slice(0, 7).map(c => `- ${c.title} - ${formatDate(c.date)}${c.dueTime ? ` at ${c.dueTime.slice(0, 5)}` : ''}${c.assigneeName ? ` (${c.assigneeName})` : ''}`).join('\n');
      return {
        text: `Pending household chores · next 30 days (including today):\n\n${list}${instances.length > 7 ? `\n… and ${instances.length - 7} more occurrences` : ''}`,
        quickActions: [{ label: 'Add more', action: 'add a chore called ' }, { label: 'Show overdue', action: "what's overdue" }],
      };
    }

    case 'list_members': {
      if (teamMembers.length === 0) {
        return { text: 'No family members yet. Add someone from the family menu.' };
      }

      const memberList = teamMembers
        .map((m) => {
          const assignedCount = chores.filter((c) => c.assigneeId === m.id).length;
          return `- ${m.name} (${m.points || 0} pts, ${assignedCount} assigned)`;
        })
        .join('\n');

      return { text: `Family members:\n\n${memberList}` };
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

      return { text: response + '. Review the form before saving.' };
    }

    case 'complete_chore': {
      const data = action.data!;
      const chore = findChore(data.title!, chores);
      if (!chore) {
        return {
          text: `I couldn't find one unique chore matching "${data.title}". Try "show chores" to see available ones.`,
          quickActions: [{ label: 'Show chores', action: 'show chores' }],
        };
      }
      return { text: `Review the occurrence and who completed "${chore.title}" before confirming.` };
    }

    case 'delete_chore': {
      const data = action.data!;
      const chore = findChore(data.title!, chores);
      if (!chore) {
        return {
          text: `I couldn't find one unique chore matching "${data.title}". Try "show chores" to see available ones.`,
          quickActions: [{ label: 'Show chores', action: 'show chores' }],
        };
      }
      return { text: `Open "${chore.title}" in Chores or Calendar, then use Delete in its chore form. Nothing has been deleted.` };
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

    case 'unknown':
    default:
      return {
        text: `I'm not sure what you mean. Try "help" to see what I can do, or start with "Add a chore called…" to prepare a chore for review.`,
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
  const tomorrow = shiftDate(dateKey(today), 1);

  if (dateStr === dateKey(today)) {
    return 'today';
  }

  if (dateStr === tomorrow) {
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
