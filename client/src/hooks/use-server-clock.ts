'use client';

import * as React from 'react';

/**
 * A clock that follows the server, not the device. The offset is measured once
 * per server timestamp, so a phone with the wrong time still shows office time.
 * Ticks once a second, aligned to the second boundary.
 */
export function useServerClock(serverTime: string | undefined) {
  const offset = React.useMemo(() => (serverTime ? new Date(serverTime).getTime() - Date.now() : 0), [serverTime]);
  const [now, setNow] = React.useState(() => new Date(Date.now() + offset));

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const t = Date.now() + offset;
      setNow(new Date(t));
      timer = setTimeout(tick, 1000 - (t % 1000) + 5);
    };
    tick();
    return () => clearTimeout(timer);
  }, [offset]);

  return now;
}
