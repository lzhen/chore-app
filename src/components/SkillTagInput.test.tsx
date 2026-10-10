import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { SkillTagInput } from './SkillTagInput';
afterEach(cleanup);
it('keeps the skill entry, suggestion, duplicate, and named removal behaviors on readable controls', async () => {
  const user = userEvent.setup();
  function Host() { const [skills, setSkills] = useState(['Cooking']); return <SkillTagInput skills={skills} onChange={setSkills} />; }
  render(<Host />);
  const input = screen.getByRole('textbox', { name: 'Skills' });
  expect(input).toHaveClass('nesmi-secondary-field');
  await user.type(input, 'Clean');
  await user.click(screen.getByRole('button', { name: 'Cleaning' }));
  expect(screen.getByRole('button', { name: 'Remove Cleaning skill' })).toBeInTheDocument();
  await user.type(input, 'Cooking{Enter}');
  expect(screen.getAllByRole('button', { name: 'Remove Cooking skill' })).toHaveLength(1);
  await user.type(input, 'Repairs{Enter}');
  expect(screen.getByRole('button', { name: 'Remove Repairs skill' })).toBeInTheDocument();
  await user.keyboard('{Backspace}');
  expect(screen.queryByRole('button', { name: 'Remove Repairs skill' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Remove Cooking skill' }));
  expect(screen.queryByRole('button', { name: 'Remove Cooking skill' })).not.toBeInTheDocument();
});
it('disables entry and removal with its parent form', () => {
  const change = vi.fn();
  render(<SkillTagInput disabled skills={['Cooking']} onChange={change} />);
  expect(screen.getByRole('textbox')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Remove Cooking skill' })).toBeDisabled();
  expect(change).not.toHaveBeenCalled();
});
it('keeps suggestions open during keyboard focus within the widget and closes them on Escape', async () => {
  const user = userEvent.setup();
  const change = vi.fn();
  render(<><SkillTagInput skills={[]} onChange={change} /><button>Outside control</button></>);
  await user.click(screen.getByRole('textbox', { name: 'Skills' }));
  await user.tab();
  expect(screen.getByRole('button', { name: 'Cooking' })).toHaveFocus();
  await new Promise(resolve => setTimeout(resolve, 250));
  expect(screen.getByRole('button', { name: 'Cooking' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('button', { name: 'Cooking' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Skills' })).toHaveFocus();
  expect(change).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Outside control' }));
  expect(screen.queryByRole('button', { name: 'Cooking' })).not.toBeInTheDocument();
});
