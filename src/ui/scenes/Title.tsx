import { useState } from 'react';
import type { Address } from '../../engine/types.ts';
import { useGame } from '../../state/gameStore.ts';
import { art } from '../assets.ts';
import { Stamp } from '../components/Stamp.tsx';
import { strings as S } from '../strings.ts';
import { Settings } from './Settings.tsx';

/** Title screen and the nomination form (name and form of address). */
export function Title() {
  const hasSave = useGame((s) => s.hasSave);
  const startNewGame = useGame((s) => s.startNewGame);
  const continueGame = useGame((s) => s.continueGame);
  const [form, setForm] = useState(false);
  const [settings, setSettings] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState<Address>('bhaiya');
  const bg = art('scene-village-desk');

  return (
    <div className="title-scene">
      <img className="desk-bg title-bg" src={bg.src} srcSet={bg.srcSet} alt="" draggable={false} />
      {settings ? (
        <Settings onClose={() => setSettings(false)} />
      ) : !form ? (
        <div className="title-menu">
          <h1 className="title-stamp">{S.title}</h1>
          <p className="title-tagline">{S.tagline}</p>
          <div className="title-buttons">
            <Stamp onClick={() => setForm(true)}>{S.menu.newGame}</Stamp>
            {hasSave && <Stamp onClick={continueGame}>{S.menu.continue}</Stamp>}
            <Stamp onClick={() => setSettings(true)}>{S.menu.settings}</Stamp>
          </div>
        </div>
      ) : (
        <form
          className="paper nomination"
          onSubmit={(e) => {
            e.preventDefault();
            startNewGame(name, address);
          }}
        >
          <h2>{S.menu.formTitle}</h2>
          <label className="field">
            <span>{S.menu.nameLabel}</span>
            <input
              className="hand"
              value={name}
              maxLength={40}
              autoFocus
              placeholder={S.menu.namePlaceholder}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="field">
            <span>{S.menu.addressLabel}</span>
            <div className="choice">
              {(['bhaiya', 'didi'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`choice-chip hand${address === a ? ' on' : ''}`}
                  aria-pressed={address === a}
                  onClick={() => setAddress(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className="form-foot">
            <Stamp onClick={() => setForm(false)}>{S.back}</Stamp>
            <Stamp type="submit" disabled={!name.trim()}>
              {S.menu.file}
            </Stamp>
          </div>
        </form>
      )}
    </div>
  );
}
