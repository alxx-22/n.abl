// Basics, for any kind of business: the name, what it does, where it is, the
// voice and greeting, and the accent colour. The words that name the business
// come from the preset ("Restaurant name", "Style or cuisine").

import { useEffect, useRef, useState } from 'react';
import { DEMO_API, audioBlob, demoApi } from '../../../api.ts';
import { PlayIcon } from '../../../components/Icons.tsx';
import { toast } from '../../../components/Toaster.tsx';
import type { VoiceMeta } from '../../../types.ts';
import { Source, Text } from '../fields.tsx';
import type { StepProps } from '../registry.ts';

export interface BasicsCopy {
  name: string;
  style: string;
  stylePlaceholder: string;
  styleHint: string;
  accentHint: string;
}

let voiceCache: VoiceMeta | null = null;

/** A business's three colours: the accent on buttons and links, the main colour on the top bar, the background for its pages. */
const COLOURS = [['accent', 'Accent'], ['primary', 'Main colour'], ['background', 'Background']] as const;

export function Basics({ a, set, ws, copy }: StepProps & { copy: BasicsCopy }) {
  const [voices, setVoices] = useState<VoiceMeta | null>(voiceCache);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!voiceCache) demoApi<VoiceMeta>('/voices').then((v) => setVoices((voiceCache = v))).catch(() => {});
    return () => audio.current?.pause();
  }, []);
  const hear = async () => {
    setPlaying(true);
    try {
      const blob = await audioBlob(`${DEMO_API}/workspaces/${ws.id}/voice-preview`, { voice: a.basics.voice, greeting: a.basics.greeting || ws.preview?.greeting }, false);
      audio.current?.pause();
      audio.current = new Audio(URL.createObjectURL(blob));
      await audio.current.play();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setPlaying(false);
    }
  };
  const s = a.sources;
  return (
    <div className="fields">
      <Text label={<>{copy.name} <Source of="basics.name" sources={s} /></>} value={a.basics.name} max={60} onChange={(v) => set((d) => void (d.basics.name = v))} hint="In the greeting, every text, and everything the receptionist says." />
      <Text label={<>{copy.style} <Source of="basics.style" sources={s} /></>} value={a.basics.style} max={160} placeholder={copy.stylePlaceholder} onChange={(v) => set((d) => void (d.basics.style = v))} hint={copy.styleHint} />
      <div className="two">
        <Text label={<>Town <Source of="basics.town" sources={s} /></>} value={a.basics.town} max={60} onChange={(v) => set((d) => void (d.basics.town = v))} />
        <Text label={<>Phone number shown <Source of="basics.phone_display" sources={s} /></>} value={a.basics.phone_display} max={20} onChange={(v) => set((d) => void (d.basics.phone_display = v))} />
      </div>
      <Text label={<>Address <Source of="basics.address" sources={s} /></>} value={a.basics.address} max={160} placeholder="12 High Street, fictional is fine" onChange={(v) => set((d) => void (d.basics.address = v))} hint="For directions questions. A made-up address is fine for a demo." />

      <div className="field">
        <label htmlFor="b-voice">Voice</label>
        <div className="field-row">
          <select id="b-voice" value={a.basics.voice} onChange={(e) => set((d) => void (d.basics.voice = e.target.value))}>
            {(voices?.voices ?? [{ name: a.basics.voice, style: '' }]).map((v) => (
              <option key={v.name} value={v.name}>{v.name}{v.style ? ` (${v.style})` : ''}</option>
            ))}
          </select>
          <button type="button" onClick={hear} disabled={playing}><PlayIcon /> {playing ? 'Generating…' : 'Hear it'}</button>
        </div>
      </div>
      <Text
        label="Greeting" area rows={2} max={300} value={a.basics.greeting} placeholder={ws.preview?.greeting}
        onChange={(v) => set((d) => void (d.basics.greeting = v))}
        hint="Leave empty for the one shown. Yours must say it is an AI assistant and that this is a demo line."
      />
      <fieldset className="field colours">
        <legend>Colours <Source of="theme.accent" sources={s} /></legend>
        <div className="colour-row">
          {COLOURS.map(([key, label]) => (
            <label key={key} className="colour">
              <input type="color" id={`b-${key}`} value={/^#[0-9a-f]{6}$/i.test(a.theme[key]) ? a.theme[key] : '#000000'} onChange={(e) => set((d) => void (d.theme[key] = e.target.value))} />
              <span>{label}<span className="mono small dim"> {a.theme[key]}</span></span>
            </label>
          ))}
          {a.theme.logo ? <img className="logo-preview" src={a.theme.logo} alt="Your logo" /> : null}
        </div>
        <p className="hint">{copy.accentHint} A light background gives light pages, a dark one dark pages; text is kept readable either way.</p>
      </fieldset>
    </div>
  );
}
