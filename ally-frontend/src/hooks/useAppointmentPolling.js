import { useEffect } from 'react';

export default function useAppointmentPolling(enabled, setRefresh) {
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setRefresh(value => value + 1);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [enabled, setRefresh]);
}
