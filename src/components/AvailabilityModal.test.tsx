import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvailabilityModal } from './AvailabilityModal';
import { MemberAvailability, TeamMember } from '../types';

const app = vi.hoisted(() => ({
  state: { availability: [] as MemberAvailability[] },
  addAvailability: vi.fn(),
  deleteAvailability: vi.fn(),
}));
vi.mock('../context/AppContext', () => ({ useApp: () => app }));
const member: TeamMember = { id: 'jen', name: 'Jen', color: '#ede8d8', points: 0, badges: [] };
const period: MemberAvailability = { id: 'away-1', memberId: 'jen', startDate: '2026-10-12', endDate: '2026-10-14', reason: 'Family trip' };

function fillDates(start = '2026-10-12', end = '2026-10-14') {
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: start } });
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: end } });
}

beforeEach(() => {
  app.state.availability = [];
  app.addAvailability.mockReset().mockResolvedValue(undefined);
  app.deleteAvailability.mockReset().mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); document.getElementById('root')?.remove(); });

describe('availability dialog', () => {
  it('groups a labelled form and compact empty state in the shared centered dialog', () => {
    render(<AvailabilityModal member={member} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Jen’s availability' });
    expect(dialog.parentElement).toHaveClass('is-centered');
    expect(within(dialog).getByRole('form', { name: 'Add unavailable dates' })).toBeInTheDocument();
    expect(screen.getByLabelText('Start date')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('End date')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Reason (optional)')).toHaveAttribute('placeholder', 'Optional note');
    expect(screen.getByRole('heading', { name: 'Unavailable dates' })).toBeInTheDocument();
    expect(screen.getByText('No unavailable dates yet.')).toBeInTheDocument();
    expect(screen.queryByText(/Unavailable Period/)).not.toBeInTheDocument();
  });

  it('rejects missing dates and reversed dates without a write', async () => {
    const user = userEvent.setup();
    render(<AvailabilityModal member={member} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Add dates' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a start and end date.');
    fillDates('2026-10-14', '2026-10-12');
    expect(screen.getByLabelText('End date')).toHaveAttribute('min', '2026-10-14');
    await user.click(screen.getByRole('button', { name: 'Add dates' }));
    expect(screen.getByRole('alert')).toHaveTextContent('End date must be on or after the start date.');
    expect(screen.getByLabelText('End date')).toHaveAttribute('aria-invalid', 'true');
    expect(app.addAvailability).not.toHaveBeenCalled();
  });

  it('saves one-day availability and clears all fields only after success', async () => {
    const user = userEvent.setup();
    render(<AvailabilityModal member={member} onClose={vi.fn()} />);
    fillDates('2026-10-12', '2026-10-12');
    await user.type(screen.getByLabelText('Reason (optional)'), 'Family trip');
    await user.click(screen.getByRole('button', { name: 'Add dates' }));
    expect(app.addAvailability).toHaveBeenCalledWith('jen', '2026-10-12', '2026-10-12', 'Family trip');
    expect(screen.getByLabelText('Start date')).toHaveValue('');
    expect(screen.getByLabelText('End date')).toHaveValue('');
    expect(screen.getByLabelText('Reason (optional)')).toHaveValue('');
  });

  it('keeps the optional reason optional', async () => {
    render(<AvailabilityModal member={member} onClose={vi.fn()} />);
    fillDates();
    await userEvent.click(screen.getByRole('button', { name: 'Add dates' }));
    expect(app.addAvailability).toHaveBeenCalledWith('jen', '2026-10-12', '2026-10-14', undefined);
  });

  it('retains dates and reason on save failure and permits a successful retry', async () => {
    app.addAvailability.mockRejectedValueOnce(new Error('Could not save availability. Please try again.'));
    const user = userEvent.setup();
    render(<AvailabilityModal member={member} onClose={vi.fn()} />);
    fillDates();
    await user.type(screen.getByLabelText('Reason (optional)'), 'Family trip');
    await user.click(screen.getByRole('button', { name: 'Add dates' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save availability. Please try again.');
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-10-12');
    expect(screen.getByLabelText('End date')).toHaveValue('2026-10-14');
    expect(screen.getByLabelText('Reason (optional)')).toHaveValue('Family trip');
    await user.click(screen.getByRole('button', { name: 'Add dates' }));
    expect(app.addAvailability).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Reason (optional)')).toHaveValue('');
  });

  it('blocks repeated submissions and dismissal while saving', async () => {
    let finish!: () => void;
    app.addAvailability.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const onClose = vi.fn(), user = userEvent.setup();
    render(<AvailabilityModal member={member} onClose={onClose} />);
    fillDates();
    const form = screen.getByRole('form', { name: 'Add unavailable dates' });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(app.addAvailability).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();
    expect(screen.getByLabelText('Start date')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeDisabled();
    await user.keyboard('{Escape}');
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(screen.getByRole('button', { name: 'Add dates' })).toBeEnabled();
  });

  it('shows only this member’s dates and reason and removes only the selected record', async () => {
    app.state.availability = [period, { ...period, id: 'other-away', memberId: 'alex', reason: 'Other member' }];
    render(<AvailabilityModal member={member} onClose={vi.fn()} />);
    expect(screen.getByText('Oct 12, 2026 – Oct 14, 2026')).toBeInTheDocument();
    expect(screen.getByText('Family trip')).toBeInTheDocument();
    expect(screen.queryByText('Other member')).not.toBeInTheDocument();
    expect(app.deleteAvailability).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Remove dates Oct 12, 2026 – Oct 14, 2026' }));
    expect(app.deleteAvailability).toHaveBeenCalledExactlyOnceWith('away-1');
  });

  it('keeps a failed removal visible, displays its error and permits retry', async () => {
    app.state.availability = [period];
    app.deleteAvailability.mockRejectedValueOnce(new Error('Could not delete availability. Please try again.'));
    const user = userEvent.setup();
    render(<AvailabilityModal member={member} onClose={vi.fn()} />);
    const remove = screen.getByRole('button', { name: /Remove dates/ });
    await user.click(remove);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete availability. Please try again.');
    expect(screen.getByText('Family trip')).toBeInTheDocument();
    await user.click(remove);
    expect(app.deleteAvailability).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('closes with the close button, Escape and backdrop without saving', async () => {
    const user = userEvent.setup(), onClose = vi.fn();
    render(<AvailabilityModal member={member} onClose={onClose} />);
    fillDates();
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    await user.keyboard('{Escape}');
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(3);
    expect(app.addAvailability).not.toHaveBeenCalled();
    expect(app.deleteAvailability).not.toHaveBeenCalled();
  });

  it('uses one dialog, locks background scrolling and restores the trigger on dismissal', async () => {
    const root = document.createElement('div'); root.id = 'root'; document.body.append(root);
    function Example() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Availability</button>{open && <AvailabilityModal member={member} onClose={() => setOpen(false)} />}</>;
    }
    const user = userEvent.setup();
    render(<Example />, { container: root });
    const trigger = screen.getByRole('button', { name: 'Availability' });
    await user.click(trigger);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(root.inert).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(root.inert).toBe(false);
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(trigger).toHaveFocus();
  });
});
