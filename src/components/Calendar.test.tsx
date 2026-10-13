import { createRef } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Calendar, CalendarRef } from './Calendar';
import { Chore, ChoreCompletion, TeamMember } from '../types';

const app = vi.hoisted(() => ({
  state: { chores: [] as Chore[], teamMembers: [] as TeamMember[], completions: [] as ChoreCompletion[] },
  updateChore: vi.fn(),
}));
vi.mock('../context/AppContext', () => ({ useApp: () => app }));
vi.mock('./CompletionDialog', () => ({ CompletionDialog: ({ onClose }: { onClose: () => void }) => <div role="dialog" aria-label="Complete chore"><button onClick={onClose}>Cancel completion</button></div> }));

const chore: Chore = { id: 'laundry', title: 'Fold the laundry and put the clean towels in the upstairs cupboard', date: '2026-10-10', dueTime: '09:30', endTime: '10:30', assigneeId: 'alex', recurrence: 'none', priority: 'medium', description: 'Keep the full chore details available.' };
function setMobile(matches: boolean) {
  vi.mocked(window.matchMedia).mockImplementation(query => ({ matches, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
}
function mount() {
  const ref = createRef<CalendarRef>();
  const onAddClick = vi.fn(), onEventClick = vi.fn();
  return { ...render(<Calendar ref={ref} onAddClick={onAddClick} onEventClick={onEventClick} />), ref, onAddClick, onEventClick };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 10, 12));
  setMobile(false);
  app.state.chores = [{ ...chore }];
  app.state.teamMembers = [{ id: 'alex', name: 'Alex', color: '#3b82f6', points: 0, badges: [] }];
  app.state.completions = [];
  app.updateChore.mockReset().mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('calendar presentation with FullCalendar', () => {
  it('starts on a natural-height desktop month with grouped date and view controls', () => {
    const { container } = mount();
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'Calendar dates' }).querySelectorAll('button')).toHaveLength(3);
    const views = screen.getByRole('group', { name: 'Calendar view' });
    expect(within(views).getAllByRole('button')).toHaveLength(4);
    expect(within(views).getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.fc-header-toolbar')).not.toBeInTheDocument();
    expect(container.querySelector('.fc-view-harness')).not.toHaveClass('fc-view-harness-active');
    expect(container.querySelectorAll('.fc-daygrid-body tbody tr')).toHaveLength(5);
    expect(screen.queryByRole('button', { name: /Add/ })).not.toBeInTheDocument();
  });

  it('navigates the existing calendar API and uses date-specific week/day titles', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading')).toHaveTextContent('November 2026');
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('heading')).toHaveTextContent('October 2026');
    await user.click(screen.getByRole('button', { name: 'Today' }));
    await user.click(screen.getByRole('button', { name: 'Week' }));
    expect(screen.getByRole('heading')).toHaveTextContent(/Oct 4\s*[–-]\s*10, 2026/);
    expect(screen.getByRole('button', { name: 'Next week' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Day' }));
    expect(screen.getByRole('heading')).toHaveTextContent('Sat, Oct 10, 2026');
    await user.click(screen.getByRole('button', { name: 'Next day' }));
    expect(screen.getByRole('heading')).toHaveTextContent('Sun, Oct 11, 2026');
    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByRole('heading')).toHaveTextContent('Sat, Oct 10, 2026');
    expect(app.updateChore).not.toHaveBeenCalled();
  });

  it('starts mobile in Agenda, preserves a chosen date through views and does not reset on resize', async () => {
    setMobile(true);
    const user = userEvent.setup();
    const { ref, container } = mount();
    expect(screen.getByRole('button', { name: 'Agenda' })).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.fc-listWeek-view')).toBeInTheDocument();
    act(() => ref.current?.gotoDate(new Date(2026, 9, 21, 12)));
    await user.click(screen.getByRole('button', { name: 'Month' }));
    await user.click(screen.getByRole('button', { name: 'Day' }));
    expect(screen.getByRole('heading')).toHaveTextContent('Wed, Oct 21, 2026');
    setMobile(false);
    fireEvent(window, new Event('resize'));
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading')).toHaveTextContent('Wed, Oct 21, 2026');
  });

  it('shows localized timed event text with semantic time and retains full details from the keyboard', async () => {
    const user = userEvent.setup();
    const { container, onEventClick } = mount();
    const time = container.querySelector('time')!;
    expect(time).toHaveTextContent('9:30 AM');
    expect(time.getAttribute('datetime')).toMatch(/^2026-10-10T09:30:00/);
    const event = container.querySelector<HTMLElement>('.fc-daygrid-event')!;
    expect(event).toHaveAttribute('tabindex', '0');
    expect(screen.getByTitle(chore.title)).toHaveTextContent(chore.title);
    event.focus();
    await user.keyboard('{Enter}');
    const details = screen.getByRole('dialog', { name: chore.title });
    expect(within(details).getByText('Keep the full chore details available.')).toBeVisible();
    expect(within(details).getByText(/09:30 – 10:30/)).toBeVisible();
    await user.click(within(details).getByRole('button', { name: 'Edit' }));
    expect(onEventClick).toHaveBeenCalledExactlyOnceWith(chore, '2026-10-10');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps localized Agenda times and full-length titles readable without duplicate time content', () => {
    setMobile(true);
    const { container } = mount();
    const row = container.querySelector('.fc-list-event')!;
    expect(row.querySelector('.fc-list-event-time')).toHaveTextContent(/9:30 AM\s*-\s*10:30 AM/);
    expect(row.querySelector('.nesmi-calendar-event-title')).toHaveTextContent(chore.title);
    expect(row.querySelector('time')).not.toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('Alex')).toBeVisible();
  });

  it('keeps all-day events free of invented times and retains completion and dismissal flows', async () => {
    app.state.chores = [{ ...chore, dueTime: undefined, endTime: undefined }];
    const user = userEvent.setup();
    const { container } = mount();
    expect(container.querySelector('time')).not.toBeInTheDocument();
    await user.click(container.querySelector('.fc-daygrid-event')!);
    expect(screen.getByText(/All day/)).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(container.querySelector('.fc-daygrid-event')!);
    await user.click(screen.getByRole('button', { name: 'Mark complete' }));
    expect(screen.getByRole('dialog', { name: 'Complete chore' })).toBeVisible();
    expect(screen.queryByRole('dialog', { name: chore.title })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel completion' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(app.updateChore).not.toHaveBeenCalled();
  });

  it('retains keyboard-reachable +more and all hidden events in the month popover', async () => {
    // jsdom has no positioned layout; give FullCalendar's portal its browser offset parent.
    vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(document.body);
    app.state.chores = Array.from({ length: 5 }, (_, index) => ({ ...chore, id: `event-${index}`, title: `Chore ${index + 1}`, dueTime: undefined, endTime: undefined }));
    const user = userEvent.setup();
    const { container } = mount();
    const more = container.querySelector<HTMLElement>('.fc-more-link')!;
    expect(more).toHaveAttribute('tabindex', '0');
    more.focus();
    await user.keyboard('{Enter}');
    expect(more).toHaveAttribute('aria-expanded', 'true');
    const overflow = container.querySelector('.fc-more-popover')!;
    expect(overflow.querySelectorAll('.fc-event')).toHaveLength(5);
    await user.click(within(overflow as HTMLElement).getByText('Chore 5'));
    expect(screen.getByRole('dialog', { name: 'Chore 5' })).toBeVisible();
  });

  it('keeps parent planning/keyboard navigation synchronized with visible view controls', () => {
    const { ref } = mount();
    act(() => { ref.current?.changeView('listWeek'); ref.current?.next(); });
    expect(screen.getByRole('button', { name: 'Agenda' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading')).toHaveTextContent(/Oct 11\s*[–-]\s*17, 2026/);
    act(() => ref.current?.prev());
    expect(screen.getByRole('heading')).toHaveTextContent(/Oct 4\s*[–-]\s*10, 2026/);
    act(() => { ref.current?.gotoDate(new Date(2026, 10, 1, 12)); ref.current?.today(); });
    expect(screen.getByRole('heading')).toHaveTextContent(/Oct 4\s*[–-]\s*10, 2026/);
  });
});
