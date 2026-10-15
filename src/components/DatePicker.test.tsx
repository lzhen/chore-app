import {render,screen,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {DatePicker,validDate} from './DatePicker';
afterEach(cleanup);
it('rejects invalid dates and accepts real leap days',()=>{expect(validDate('2028-02-29')).toBe(true);expect(validDate('2026-02-29')).toBe(false);expect(validDate('2026-13-01')).toBe(false);expect(validDate('')).toBe(false);});
it('disables both typing and the calendar trigger while busy',()=>{render(<DatePicker value="2026-10-15" onChange={vi.fn()} disabled/>);expect(screen.getByLabelText('When?')).toBeDisabled();expect(screen.getByRole('button',{name:'Choose date'})).toBeDisabled();});
