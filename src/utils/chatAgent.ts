import { Chore, TeamMember, RecurrenceType } from '../types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatAction {
  type: 'add_chore' | 'assign_chore' | 'list_chores' | 'list_members' | 'help' | 'unknown';
  data?: {
    title?: string;
    date?: string;
    assigneeName?: string;
    recurrence?: RecurrenceType;
  };
}

/**
 * Parse a date string from natural language
 */
function parseDate(text: string): string | null {
  const today = new Date();
  const lowerText = text.toLowerCase();

  if (lowerText.includes('today')) {
    return today.toISOString().split('T')[0];
  }

  if (lowerText.includes('tomorrow')) {
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    return tomorrow.toISOString().split('T')[0];
  }

  if (lowerText.includes('next week')) {
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return nextWeek.toISOString().split('T')[0];
  }

  // Try to find day names
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < days.length; i++) {
    if (lowerText.includes(days[i])) {
      const currentDay = today.getDay();
      let daysUntil = i - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      const targetDate = new Date(today.getTime() + daysUntil * 24 * 60 * 60 * 1000);
      return targetDate.toISOString().split('T')[0];
    }
  }

  // Try to parse explicit date formats
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1]);
    const day = parseInt(dateMatch[2]);
    const year = dateMatch[3] ? parseInt(dateMatch[3]) : today.getFullYear();
    const fullYear = year < 100 ? 2000 + year : year;
    return `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return null;
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
  const lowerName = name.toLowerCase();

  // Exact match first
  const exact = teamMembers.find((m) => m.name.toLowerCase() === lowerName);
  if (exact) return exact;

  // Partial match
  const partial = teamMembers.find((m) => m.name.toLowerCase().includes(lowerName));
  if (partial) return partial;

  // Check if member name includes the search term
  const reverse = teamMembers.find((m) => lowerName.includes(m.name.toLowerCase()));
  if (reverse) return reverse;

  return null;
}

/**
 * Parse user input to determine intent
 */
export function parseUserInput(input: string, teamMembers: TeamMember[]): ChatAction {
  const lowerInput = input.toLowerCase().trim();

  // Help command
  if (lowerInput === 'help' || lowerInput === '?' || lowerInput.includes('what can you do')) {
    return { type: 'help' };
  }

  // List chores
  if (
    lowerInput.includes('list chores') ||
    lowerInput.includes('show chores') ||
    lowerInput.includes('my chores') ||
    lowerInput.includes('upcoming chores') ||
    lowerInput.includes("what's due") ||
    lowerInput.includes('what is due')
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

  // Add chore patterns
  const addPatterns = [
    /add (?:a )?(?:chore|task) (?:called |named |for )?["']?([^"']+?)["']?(?:\s+(?:on|for|due)\s+(.+))?$/i,
    /create (?:a )?(?:chore|task) (?:called |named |for )?["']?([^"']+?)["']?(?:\s+(?:on|for|due)\s+(.+))?$/i,
    /new (?:chore|task)[:\s]+["']?([^"']+?)["']?(?:\s+(?:on|for|due)\s+(.+))?$/i,
    /schedule ["']?([^"']+?)["']?(?:\s+(?:on|for|due)\s+(.+))?$/i,
  ];

  for (const pattern of addPatterns) {
    const match = input.match(pattern);
    if (match) {
      const title = match[1].trim();
      const dateContext = match[2] || input;
      const date = parseDate(dateContext) || new Date().toISOString().split('T')[0];
      const recurrence = parseRecurrence(input);

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
        data: { title, date, recurrence, assigneeName },
      };
    }
  }

  // Assign chore pattern
  const assignPatterns = [
    /assign\s+["']?(.+?)["']?\s+to\s+(\w+)/i,
    /give\s+["']?(.+?)["']?\s+to\s+(\w+)/i,
  ];

  for (const pattern of assignPatterns) {
    const match = input.match(pattern);
    if (match) {
      const choreTitle = match[1].trim();
      const memberName = match[2].trim();
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

  // If input looks like a chore description, try to add it
  if (lowerInput.length > 3 && !lowerInput.startsWith('hi') && !lowerInput.startsWith('hello')) {
    const date = parseDate(input) || new Date().toISOString().split('T')[0];
    const recurrence = parseRecurrence(input);

    // Clean up the title
    let title = input
      .replace(/\b(today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
      .replace(/\b(daily|weekly|monthly|every day|every week|every month)\b/gi, '')
      .replace(/\b(on|for|due)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (title.length > 2) {
      return {
        type: 'add_chore',
        data: { title, date, recurrence },
      };
    }
  }

  return { type: 'unknown' };
}

/**
 * Generate a response based on the parsed action
 */
export function generateResponse(
  action: ChatAction,
  chores: Chore[],
  teamMembers: TeamMember[]
): string {
  switch (action.type) {
    case 'help':
      return `Here's what I can help you with:

- **Add a chore**: "Add a chore called Clean kitchen tomorrow"
- **Schedule recurring**: "Add vacuum weekly on Monday"
- **List chores**: "Show my upcoming chores"
- **List team**: "Who is on the team?"
- **Assign**: "Assign Clean kitchen to John"

Just type what you need and I'll try to understand!`;

    case 'list_chores': {
      const today = new Date().toISOString().split('T')[0];
      const upcoming = chores
        .filter((c) => c.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 5);

      if (upcoming.length === 0) {
        return 'No upcoming chores found. Would you like to add one?';
      }

      const choreList = upcoming
        .map((c) => {
          const assignee = teamMembers.find((m) => m.id === c.assigneeId);
          const assigneeText = assignee ? ` (${assignee.name})` : '';
          return `- ${c.title} on ${formatDate(c.date)}${assigneeText}`;
        })
        .join('\n');

      return `Here are your upcoming chores:\n\n${choreList}`;
    }

    case 'list_members': {
      if (teamMembers.length === 0) {
        return 'No team members yet. Add some from the sidebar!';
      }

      const memberList = teamMembers.map((m) => `- ${m.name}`).join('\n');
      return `Team members:\n\n${memberList}`;
    }

    case 'add_chore': {
      const data = action.data!;
      let response = `I'll add "${data.title}" for ${formatDate(data.date!)}`;

      if (data.recurrence && data.recurrence !== 'none') {
        response += ` (${data.recurrence})`;
      }

      if (data.assigneeName) {
        response += ` assigned to ${data.assigneeName}`;
      }

      return response + '. Creating it now...';
    }

    case 'assign_chore': {
      const data = action.data!;
      if (!data.assigneeName) {
        return `I couldn't find that team member. Available members: ${teamMembers.map((m) => m.name).join(', ')}`;
      }
      return `Assigning "${data.title}" to ${data.assigneeName}...`;
    }

    case 'unknown':
    default:
      return `I'm not sure what you mean. Try saying "help" to see what I can do, or just describe the chore you want to add!`;
  }
}

/**
 * Format a date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  if (dateStr === today.toISOString().split('T')[0]) {
    return 'today';
  }

  if (dateStr === tomorrow.toISOString().split('T')[0]) {
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
