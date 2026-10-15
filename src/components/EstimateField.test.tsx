import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { EstimateField } from './EstimateField';
afterEach(cleanup);
function Field() { const [value, setValue] = useState(''); return <EstimateField value={value} onChange={setValue}/>; }
it('keeps an optional estimate empty and steps only positive whole values', async () => {
  const user = userEvent.setup(); render(<Field/>);
  const input = screen.getByRole('spinbutton');
  expect(input).toHaveValue(null);
  expect(screen.getByRole('button', {name: 'Decrease estimated minutes'})).toBeDisabled();
  await user.click(screen.getByRole('button', {name: 'Increase estimated minutes'}));
  expect(input).toHaveValue(1);
  await user.click(screen.getByRole('button', {name: 'Increase estimated minutes'}));
  await user.click(screen.getByRole('button', {name: 'Decrease estimated minutes'}));
  expect(input).toHaveValue(1);
  await user.clear(input); expect(input).toHaveValue(null);
});
it('preserves invalid input with associated recovery feedback instead of silently clamping', async () => {
  const user = userEvent.setup(); render(<Field/>);
  const input = screen.getByRole('spinbutton');
  for (const invalid of ['-13', '1.5', '0']) {
    await user.clear(input); await user.type(input, invalid);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a whole number of at least 1, or leave this blank.');
    expect(screen.getByRole('button', {name: 'Increase estimated minutes'})).toBeDisabled();
  }
  await user.clear(input); await user.type(input, '15');
  expect(input).not.toHaveAttribute('aria-invalid');
});
