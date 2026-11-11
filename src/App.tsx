import { useEffect, useState } from 'react';
import { createClock } from './engine/clock.ts';
import { strings } from './ui/strings.ts';

type ServerStatus = 'checking' | 'ok' | 'no-key' | 'down';

export function App() {
  const [status, setStatus] = useState<ServerStatus>('checking');
  const clock = createClock();

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: { openaiConfigured?: boolean }) =>
        setStatus(body.openaiConfigured ? 'ok' : 'no-key'),
      )
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          console.warn('health check failed', err);
          setStatus('down');
        }
      });
    return () => controller.abort();
  }, []);

  const statusText = {
    checking: strings.serverChecking,
    ok: strings.serverOk,
    'no-key': strings.serverNoKey,
    down: strings.serverDown,
  }[status];

  return (
    <main className="scaffold">
      <h1>{strings.title}</h1>
      <p className="tagline">{strings.tagline}</p>
      <p>{strings.scaffoldNote}</p>
      <p className="meta">
        Day {clock.day} · {clock.daysToPoll} days to poll · {clock.slotsLeftToday} slots today
      </p>
      <p className={`status status-${status}`}>{statusText}</p>
    </main>
  );
}
