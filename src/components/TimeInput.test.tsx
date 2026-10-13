import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TimeInput } from './TimeInput';
import { formatTime, parseTime } from '../utils/time';
afterEach(cleanup);
it.each([['en-US','1:30 PM'],['en-GB','13:30'],['zh-CN','13:30'],['ar-EG','١:٣٠ م']])('round trips locale %s', (locale) => {
 const text=formatTime('13:30',locale);expect(parseTime(text,locale)).toBe('13:30');
 expect(parseTime('00:00',locale)).toBe('00:00');
 expect(parseTime('12:00 AM',locale)).toBe('00:00');
 expect(parseTime('12:00 PM',locale)).toBe('12:00');
 expect(parseTime('24:10',locale)).toBeNull();expect(parseTime('13:60',locale)).toBeNull();
});
it('invalid time prevents submission; valid text updates canonical value and clearing restores all-day',()=>{
 const change=vi.fn();render(<form><TimeInput label="Start" value="" onChange={change}/></form>);
 const field=screen.getByRole('textbox',{name:'Start'}) as HTMLInputElement;
 fireEvent.change(field,{target:{value:'25:70'}});expect(field).toBeInvalid();expect(change).toHaveBeenLastCalledWith('25:70');
 fireEvent.change(field,{target:{value:'1:45 PM'}});expect(field).toBeValid();expect(change).toHaveBeenLastCalledWith('13:45');
 fireEvent.change(field,{target:{value:''}});expect(change).toHaveBeenLastCalledWith('');
});
