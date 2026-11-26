import { useEffect, useState } from 'react';
import { dateKey } from '../utils/dates';

export function useLocalDay(): string {
  const [today, setToday] = useState(dateKey);

  useEffect(() => {
    let timer: number | undefined;
    const refreshDay = () => {
      window.clearTimeout(timer);
      const now = new Date();
      setToday(dateKey(now));
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = window.setTimeout(refreshDay, nextMidnight.getTime() - now.getTime());
    };
    refreshDay();
    document.addEventListener('visibilitychange', refreshDay);
    window.addEventListener('focus', refreshDay);
    window.addEventListener('pageshow', refreshDay);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', refreshDay);
      window.removeEventListener('focus', refreshDay);
      window.removeEventListener('pageshow', refreshDay);
    };
  }, []);

  return today;
}
