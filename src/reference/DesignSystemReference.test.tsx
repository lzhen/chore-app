import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from '../context/ThemeContext';
import DesignSystemReference from './DesignSystemReference';

beforeEach(() => { localStorage.clear(); window.location.search = ''; });
afterEach(() => { cleanup(); localStorage.clear(); document.documentElement.classList.remove('dark'); document.documentElement.removeAttribute('data-theme'); });
function mount() {
  const root = document.createElement('div'); root.id = 'root'; document.body.appendChild(root);
  return render(<ThemeProvider persistPreference={false}><DesignSystemReference/></ThemeProvider>, { container: root });
}
const section = (id: string) => within(document.getElementById(id)!);

describe('private design system reference', () => {
  it('renders clearly bounded, code-backed sections and verified relative preview routes', () => {
    mount();
    expect(screen.getByRole('heading', { level: 1, name: 'Design system' })).toBeInTheDocument();
    expect(screen.getByText('Draft v0.1')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(8);
    expect(screen.getByRole('link', { name: 'Open Web preview ↗' })).toHaveAttribute('href', './index.html?experience=web');
    expect(screen.getByRole('link', { name: 'Open App simulation ↗' })).toHaveAttribute('href', './index.html?experience=app');
    expect(screen.getByRole('link', { name: 'Read the v0.1 specification ↗' })).toHaveAttribute('href', './design-system-v0.1.md');
    expect(screen.getByText(/Compact filters and dense calendar annotations retain documented smaller sizes/)).toBeInTheDocument();
  });
  it('toggles actual theme without changing the saved app preference', async () => {
    localStorage.setItem('theme', 'dark'); const user = userEvent.setup(); mount();
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(localStorage.getItem('theme')).toBe('dark');
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(localStorage.getItem('theme')).toBe('dark');
  });
  it('does not write an appearance preference when none exists', async () => {
    const user = userEvent.setup(); mount();
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(localStorage.getItem('theme')).toBeNull();
  });
  it('shows long and unassigned all-day detail content without truncation', async () => {
    const user = userEvent.setup(); mount(); const details = section('typography');
    await user.click(details.getByRole('button', { name: 'Long content' }));
    expect(details.getByText('Alexandra with a deliberately long display name')).toBeInTheDocument();
    expect(details.getByText(/A deliberately long note/)).toBeInTheDocument();
    await user.click(details.getByRole('button', { name: 'All day / unassigned' }));
    expect(details.getByText('Unassigned')).toBeInTheDocument();
    expect(details.getByText(/· All day/)).toBeInTheDocument();
    expect(details.getByText('Does not repeat')).toBeInTheDocument();
  });
  it('runs the real picker keyboard and explicit empty state', async () => {
    const user = userEvent.setup(); mount(); const input = section('inputs');
    const picker = input.getByRole('combobox', { name: 'Reference person' }); picker.focus();
    await user.keyboard('{End}{Enter}'); expect(picker).toHaveTextContent('Unassigned'); expect(picker).toHaveFocus();
    await user.click(input.getByRole('combobox', { name: 'Empty choice example' }));
    expect(screen.getByRole('listbox')).toHaveTextContent('No options available');
    await user.keyboard('{Escape}'); expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
  it('demonstrates safe destructive focus and only local action feedback', async () => {
    const user = userEvent.setup(); mount();
    const opener = screen.getByRole('button', { name: 'Try delete decision' }); await user.click(opener);
    const confirm = screen.getByRole('alertdialog'); expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.keyboard('{Escape}'); expect(opener).toHaveFocus();
    await user.click(opener); await user.click(screen.getByRole('button', { name: 'Delete sample' }));
    expect(section('actions').getByRole('status')).toHaveTextContent('No app data was removed.');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
  it('compares native date, text and person values in the actual shared field scope', async () => {
    const user = userEvent.setup(); mount();
    const fields = screen.getByRole('group', { name: 'Compare chore, person and date values' });
    expect(fields).toHaveClass('nesmi-chore-fields');
    const controls = within(fields);
    const title = controls.getByRole('textbox', { name: 'Chore' });
    const date = controls.getByLabelText('Date');
    expect(date).toHaveAttribute('type', 'date'); expect(date).toHaveValue('2030-04-12');
    await user.clear(title); await user.type(title, 'Fictional field sample');
    fireEvent.change(date, { target: { value: '2030-05-01' } });
    expect(date).toHaveValue('2030-05-01');
    await user.click(controls.getByRole('combobox', { name: 'Value scale person' }));
    await user.click(screen.getByRole('option', { name: 'Sam' }));
    expect(controls.getByRole('combobox')).toHaveTextContent('Sam');
  });
  it('keeps a failed sample form recoverable and validates the title', async () => {
    const user = userEvent.setup(); mount(); const inputs = section('inputs');
    const title = inputs.getByRole('textbox', { name: 'Chore title' });
    await user.clear(title); await user.click(inputs.getByRole('button', { name: 'Save sample' }));
    expect(inputs.getByRole('alert')).toHaveTextContent('Give this sample a title'); expect(title).toHaveFocus();
    await user.type(title, 'A fictional new chore');
    await user.click(inputs.getByRole('checkbox', { name: 'Simulate a recoverable save error' }));
    await user.click(inputs.getByRole('button', { name: 'Save sample' }));
    expect(inputs.getByRole('alert')).toHaveTextContent('Your draft is still here'); expect(title).not.toHaveAttribute('aria-invalid'); expect(title).toHaveValue('A fictional new chore');
    await user.click(inputs.getByRole('checkbox', { name: 'Simulate a recoverable save error' }));
    await user.click(inputs.getByRole('button', { name: 'Save sample' }));
    expect(inputs.queryByRole('alert')).not.toBeInTheDocument(); expect(inputs.getByRole('status')).toHaveTextContent('Sample saved in this page only.');
  });
  it('uses the real Web row for expansion, completion and inline editing', async () => {
    const user = userEvent.setup(); mount(); const patterns = section('patterns');
    await user.click(patterns.getByRole('button', { name: 'View details: Water the balcony plants' }));
    expect(patterns.getByText('Every week')).toBeInTheDocument();
    await user.click(patterns.getByRole('button', { name: 'Complete: Water the balcony plants' }));
    expect(patterns.getByRole('button', { name: 'Undo completion: Water the balcony plants' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(patterns.getByRole('button', { name: 'Edit Water the balcony plants' }));
    expect(patterns.getByRole('button', { name: 'App simulation' })).toBeDisabled();
    const title = patterns.getByRole('textbox', { name: 'Chore title' }); expect(title).toHaveFocus(); await user.clear(title); await user.type(title, 'Water a fictional fern');
    await user.click(patterns.getByRole('button', { name: 'Save sample' }));
    expect(patterns.getByRole('button', { name: 'View details: Water a fictional fern' })).toBeInTheDocument();
    expect(patterns.getByRole('button', { name: 'App simulation' })).toBeEnabled();
    expect(patterns.getByRole('button', { name: 'Edit Water a fictional fern' })).toHaveFocus();
  });
  it('protects changed App sheet drafts on close and preserves them when Cancel is chosen', async () => {
    const user = userEvent.setup(); mount(); const patterns = section('patterns');
    await user.click(patterns.getByRole('button', { name: 'App simulation' }));
    await user.click(patterns.getByRole('button', { name: 'Actions: Water the balcony plants' }));
    await user.click(screen.getByRole('button', { name: 'Edit Water the balcony plants' }));
    const editor = screen.getByRole('dialog', { name: 'Edit fictional chore' });
    await user.type(within(editor).getByRole('textbox', { name: 'Chore title' }), ' tomorrow');
    await user.click(within(editor).getByRole('button', { name: 'Close dialog' }));
    let alert = screen.getByRole('alertdialog', { name: 'Discard sample changes?' });
    await user.click(within(alert).getByRole('button', { name: 'Cancel' }));
    expect(within(editor).getByRole('textbox', { name: 'Chore title' })).toHaveValue('Water the balcony plants tomorrow');
    await user.click(within(editor).getByRole('button', { name: 'Close dialog' }));
    alert = screen.getByRole('alertdialog', { name: 'Discard sample changes?' });
    await user.click(within(alert).getByRole('button', { name: 'Discard changes' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
  it('protects a dirty inline draft before deletion and restores a usable sample', async () => {
    const user = userEvent.setup(); mount(); const patterns = section('patterns');
    await user.click(patterns.getByRole('button', { name: 'Edit Water the balcony plants' }));
    await user.type(patterns.getByRole('textbox', { name: 'Chore title' }), ' tomorrow');
    await user.click(patterns.getByRole('button', { name: 'Delete Water the balcony plants' }));
    let confirmation = screen.getByRole('alertdialog', { name: 'Discard sample changes?' });
    await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }));
    expect(patterns.getByRole('textbox', { name: 'Chore title' })).toHaveValue('Water the balcony plants tomorrow');
    await user.click(patterns.getByRole('button', { name: 'Delete Water the balcony plants' }));
    confirmation = screen.getByRole('alertdialog', { name: 'Discard sample changes?' });
    await user.click(within(confirmation).getByRole('button', { name: 'Discard changes' }));
    await user.click(screen.getByRole('button', { name: 'Delete sample series' }));
    await user.click(patterns.getByRole('button', { name: 'Restore sample' }));
    expect(patterns.getByRole('button', { name: 'App simulation' })).toBeEnabled();
    expect(patterns.queryByRole('textbox', { name: 'Chore title' })).not.toBeInTheDocument();
  });
  it('only removes the fictional row and provides a focused restore action', async () => {
    const user = userEvent.setup(); mount(); const patterns = section('patterns');
    await user.click(patterns.getByRole('button', { name: 'Delete Water the balcony plants' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('repeats weekly');
    await user.click(screen.getByRole('button', { name: 'Delete sample series' }));
    const restore = patterns.getByRole('button', { name: 'Restore sample' }); await waitFor(() => expect(restore).toHaveFocus());
    await user.click(restore); expect(patterns.getByRole('button', { name: 'View details: Water the balcony plants' })).toBeInTheDocument();
  });
  it('keeps nested picker Escape inside the real dialog and restores opener focus', async () => {
    const user = userEvent.setup(); mount(); const opener = screen.getByRole('button', { name: 'Open dialog example' }); await user.click(opener);
    await user.click(screen.getByRole('combobox', { name: 'Dialog person' })); await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument(); expect(screen.getByRole('dialog', { name: 'A focused decision' })).toBeInTheDocument();
    await user.keyboard('{Escape}'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(opener).toHaveFocus();
  });
});
