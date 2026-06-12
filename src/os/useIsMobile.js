import { useSyncExternalStore } from 'react';

// Below this width the desktop metaphor stops working: windows go kiosk
// (full-screen, taskbar tabs become the navigation).
const QUERY = '(max-width: 767px)';

function subscribe(callback) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
