import { useEffect, useState } from 'react';
import { Stamp } from '../components/Stamp.tsx';
import { strings as S } from '../strings.ts';

type TaskInfo = {
  id: string;
  label: string;
  api: string;
  default: string;
  generate: boolean;
  allowed: string[];
};
type TaskSetting = { model: string; enabled: boolean; effort: 'none' | 'low' | 'medium' };
type SettingsData = { aiEnabled: boolean; tasks: Record<string, TaskSetting> };
type Payload = {
  settings: SettingsData;
  tasks: TaskInfo[];
  keyConfigured: boolean;
  canWrite: boolean;
};

/** Owner panel: which AI model runs each task (docs/ENGINE.md §11.1). Outside the fiction on purpose. */
export function Settings({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Payload) => setData(d))
      .catch(() => setFailed(true));
  }, []);

  const update = (fn: (s: SettingsData) => void) => {
    if (!data) return;
    const next = structuredClone(data.settings);
    fn(next);
    setData({ ...data, settings: next });
    setSaved(false);
  };

  const save = async () => {
    if (!data) return;
    const r = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data.settings),
    });
    if (r.ok) {
      setData({ ...data, settings: ((await r.json()) as { settings: SettingsData }).settings });
      setSaved(true);
    }
  };

  return (
    <div className="paper settings-panel">
      <h2>{S.settings.title}</h2>
      {failed && <p className="muted">{S.settings.unreachable}</p>}
      {data && (
        <>
          {!data.keyConfigured && <p className="muted">{S.settings.noKey}</p>}
          {!data.canWrite && <p className="muted">{S.settings.readOnly}</p>}
          <div className="choice">
            {[true, false].map((on) => (
              <button
                key={String(on)}
                type="button"
                className={`choice-chip hand${data.settings.aiEnabled === on ? ' on' : ''}`}
                aria-pressed={data.settings.aiEnabled === on}
                disabled={!data.canWrite}
                onClick={() => update((s) => void (s.aiEnabled = on))}
              >
                {on ? S.settings.aiOn : S.settings.aiOff}
              </button>
            ))}
          </div>
          <table className="settings-table">
            <tbody>
              {data.tasks.map((t) => {
                const cur = data.settings.tasks[t.id]!;
                return (
                  <tr key={t.id}>
                    <th>{t.label}</th>
                    <td>
                      <select
                        value={cur.model}
                        disabled={!data.canWrite || t.allowed.length < 2}
                        onChange={(e) =>
                          update((s) => void (s.tasks[t.id]!.model = e.target.value))
                        }
                      >
                        {(t.allowed.includes(cur.model)
                          ? t.allowed
                          : [cur.model, ...t.allowed]
                        ).map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {t.generate && (
                        <label className="muted">
                          <input
                            type="checkbox"
                            checked={cur.enabled}
                            disabled={!data.canWrite}
                            onChange={(e) =>
                              update((s) => void (s.tasks[t.id]!.enabled = e.target.checked))
                            }
                          />{' '}
                          {S.settings.enabled}
                        </label>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
      <div className="form-foot">
        <Stamp onClick={onClose}>{S.back}</Stamp>
        {saved && <span className="muted">{S.settings.saved}</span>}
        {data?.canWrite && <Stamp onClick={() => void save()}>{S.settings.save}</Stamp>}
      </div>
    </div>
  );
}
