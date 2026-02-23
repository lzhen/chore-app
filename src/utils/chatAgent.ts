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

  // "in X days"
  const inDaysMatch = lowerText.match(/in\s+(\d+)\s+days?/);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1]);
    const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    return futureDate.toISOString().split('T')[0];
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
    lowerText.includes('urgent') ||
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

  // Exact match first
  const exact = teamMembers.find((m) => m.name.toLowerCase() === lowerName);
  if (exact) return exact;

  // Partial match (name starts with)
  const startsWith = teamMembers.find((m) => m.name.toLowerCase().startsWith(lowerName));
  if (startsWith) return startsWith;

  // Partial match (name contains)
  const partial = teamMembers.find((m) => m.name.toLowerCase().includes(lowerName));
  if (partial) return partial;

  // Check if member name includes the search term
  const reverse = teamMembers.find((m) => lowerName.includes(m.name.toLowerCase()));
  if (reverse) return reverse;

  return null;
}

/**
 * Find a chore by title (fuzzy match)
 */
function findChore(title: string, chores: Chore[]): Chore | null {
  const lowerTitle = title.toLowerCase().trim();

  // Exact match
  const exact = chores.find((c) => c.title.toLowerCase() === lowerTitle);
  if (exact) return exact;

  // Contains match
  const contains = chores.find((c) => c.title.toLowerCase().includes(lowerTitle));
  if (contains) return contains;

  // Reverse contains
  const reverse = chores.find((c) => lowerTitle.includes(c.title.toLowerCase()));
  if (reverse) return reverse;

  return null;
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
    /(?:complete|finish|done|mark as done|mark complete|check off)\s+["']?(.+?)["']?$/i,
    /i(?:'ve| have)? (?:completed|finished|done)\s+["']?(.+?)["']?$/i,
    /["']?(.+?)["']?\s+is (?:done|complete|finished)$/i,
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
    /(?:delete|remove|cancel)\s+["']?(.+?)["']?$/i,
    /(?:get rid of|take off)\s+["']?(.+?)["']?$/i,
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
    /add (?:a )?(?:chore|task) (?:called |named |for )?["']?([^"']+?)["']?(?:\s+(?:on|for|due)\s+(.+))?$/i,
    /create (?:a )?(?:chore|task) (?:called |named |for )?["']?([^"']+?)["']?(?:\s+(?:on|for|due)\s+(.+))?$/i,
    /new (?:chore|task)[:\s]+["']?([^"']+?)["']?(?:\s+(?:on|for|due)\s+(.+))?$/i,
    /schedule ["']?([^"']+?)["']?(?:\s+(?:on|for|due)\s+(.+))?$/i,
    /remind me to\s+["']?(.+?)["']?(?:\s+(?:on|for|due)\s+(.+))?$/i,
  ];

  for (const pattern of addPatterns) {
    const match = input.match(pattern);
    if (match) {
      const title = match[1].trim();
      const dateContext = match[2] || input;
      const date = parseDate(dateContext) || new Date().toISOString().split('T')[0];
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
    /assign\s+["']?(.+?)["']?\s+to\s+(\w+)/i,
    /give\s+["']?(.+?)["']?\s+to\s+(\w+)/i,
    /(\w+)\s+should\s+(?:do|handle)\s+["']?(.+?)["']?/i,
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

  // If input looks like a chore description, try to add it
  if (lowerInput.length > 3) {
    const date = parseDate(input) || new Date().toISOString().split('T')[0];
    const time = parseTime(input);
    const recurrence = parseRecurrence(input);
    const priority = parsePriority(input);

    // Clean up the title
    let title = input
      .replace(
        /\b(today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
        ''
      )
      .replace(/\b(daily|weekly|monthly|every day|every week|every month)\b/gi, '')
      .replace(/\b(high priority|low priority|urgent|important|asap)\b/gi, '')
      .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(am|pm)?/gi, '')
      .replace(/\b(morning|afternoon|evening|night|noon|lunch)\b/gi, '')
      .replace(/\b(on|for|due|in \d+ days?)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (title.length > 2) {
      return {
        type: 'add_chore',
        data: { title, date, time: time || undefined, recurrence, priority },
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
        text: `Here's what I can help you with:

**Add chores:**
- "Add a chore called Clean kitchen tomorrow"
- "Remind me to take out trash at 8pm"
- "Schedule vacuum weekly on Monday"
- "Add urgent task: Fix bug"

**Manage chores:**
- "Complete clean kitchen"
- "Delete meeting prep"
- "Assign dishes to John"

**View info:**
- "Show my chores"
- "Show my stats"
- "What's overdue?"
- "Who's on the team?"

Just type naturally and I'll understand!`,
        quickActions: [
          { label: 'Add a chore', action: 'add a chore called ' },
          { label: 'Show chores', action: 'show my chores' },
          { label: 'Show overdue', action: "what's overdue" },
        ],
      };

    case 'show_stats': {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const totalChores = chores.length;
      const completedThisWeek = completions.filter((c) => c.instanceDate >= weekAgo).length;
      const pending = chores.filter(
        (c) => c.date >= today && !completions.some((comp) => comp.choreId === c.id && comp.instanceDate === c.date)
      ).length;
      const overdue = chores.filter(
        (c) =>
          c.date < today &&
          c.recurrence === 'none' &&
          !completions.some((comp) => comp.choreId === c.id && comp.instanceDate === c.date)
      ).length;

      // Get top performer
      const memberCompletions = teamMembers.map((m) => ({
        name: m.name,
        count: completions.filter((c) => c.completedBy === m.id && c.instanceDate >= weekAgo).length,
        points: m.points || 0,
      }));
      const topPerformer = memberCompletions.sort((a, b) => b.count - a.count)[0];

      let statsText = `**This Week's Summary:**\n\n`;
      statsText += `- Total chores: ${totalChores}\n`;
      statsText += `- Completed this week: ${completedThisWeek}\n`;
      statsText += `- Pending: ${pending}\n`;
      if (overdue > 0) {
        statsText += `- **Overdue: ${overdue}** ⚠️\n`;
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
      const today = new Date().toISOString().split('T')[0];
      const overdueChores = chores.filter(
        (c) =>
          c.date < today &&
          c.recurrence === 'none' &&
          !completions.some((comp) => comp.choreId === c.id && comp.instanceDate === c.date)
      );

      if (overdueChores.length === 0) {
        return { text: "Great news! You have no overdue chores. 🎉" };
      }

      const list = overdueChores
        .slice(0, 5)
        .map((c) => {
          const assignee = teamMembers.find((m) => m.id === c.assigneeId);
          return `- ${c.title} (due ${formatDate(c.date)})${assignee ? ` - ${assignee.name}` : ''}`;
        })
        .join('\n');

      return {
        text: `⚠️ **Overdue chores (${overdueChores.length}):**\n\n${list}${overdueChores.length > 5 ? `\n\n...and ${overdueChores.length - 5} more` : ''}`,
        quickActions: [
          { label: 'Complete first', action: `complete ${overdueChores[0].title}` },
        ],
      };
    }

    case 'list_chores': {
      const today = new Date().toISOString().split('T')[0];
      const upcoming = chores
        .filter((c) => c.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 7);

      if (upcoming.length === 0) {
        return {
          text: 'No upcoming chores found. Would you like to add one?',
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
        text: `**Upcoming chores:**\n\n${choreList}`,
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

    case 'unknown':
    default:
      return {
        text: `I'm not sure what you mean. Try "help" to see what I can do, or just describe the chore you want to add!`,
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

/**
 * Find a chore by title (exported for use in ChatAssistant)
 */
export { findChore };
