import { useEffect, useRef, useState } from 'react';
import { api, audioBlob } from '../api.ts';
import type { Profile, VoiceMeta } from '../types.ts';
import { PlayIcon } from './Icons.tsx';
import { toast } from './Toaster.tsx';

interface Form {
  voice: string;
  greeting: string;
  language_code: string;
  reply_speed: string;
  live_model: string;
}

export function SettingsDialog({ slug, open, onClose, onSaved }: { slug: string; open: boolean; onClose: () => void; onSaved: (p: Profile) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [meta, setMeta] = useState<VoiceMeta | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    Promise.all([meta ? Promise.resolve(meta) : api<VoiceMeta>('/api/voices'), api<{ profile: Profile }>(`/api/tenants/${slug}`)])
      .then(([m, { profile }]) => {
        setMeta(m);
        setForm({
          voice: profile.voice,
          greeting: profile.greeting,
          language_code: profile.language_code === null ? '' : profile.language_code || 'en-GB',
          reply_speed: profile.reply_speed || 'normal',
          live_model: profile.live_model || '',
        });
      })
      .catch((e: Error) => toast(e.message));
  }, [open, slug]);

  useEffect(() => () => audio.current?.pause(), []);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const preview = async () => {
    if (!form) return;
    setPreviewing(true);
    try {
      const blob = await audioBlob(`/api/tenants/${slug}/voice-preview`, { voice: form.voice, greeting: form.greeting, language_code: form.language_code || null });
      audio.current?.pause();
      audio.current = new Audio(URL.createObjectURL(blob));
      await audio.current.play();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setPreviewing(false);
    }
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const { profile } = await api<{ profile: Profile }>(`/api/tenants/${slug}/settings`, {
        method: 'PATCH',
        body: JSON.stringify({ ...form, language_code: form.language_code || null, live_model: form.live_model || null }),
      });
      onSaved(profile);
      onClose();
      toast('Saved. The next call uses the new settings.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const labels = Object.fromEntries((meta?.models ?? []).map((m) => [m.id, m.label]));

  return (
    <dialog ref={dialog} className="panel settings" aria-labelledby="settings-title" onClose={onClose} onCancel={onClose}>
      <form method="dialog" onSubmit={(e) => e.preventDefault()}>
        <header>
          <h2 id="settings-title">Receptionist settings</h2>
          <button type="button" className="ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>

        {!form || !meta ? (
          <p className="empty">Loading…</p>
        ) : (
          <>
            <label htmlFor="set-voice">Voice</label>
            <div className="field-row">
              <select id="set-voice" value={form.voice} onChange={(e) => set('voice', e.target.value)}>
                {meta.voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.style})
                  </option>
                ))}
              </select>
              <button type="button" id="set-preview" onClick={preview} disabled={previewing}>
                <PlayIcon /> {previewing ? 'Generating…' : 'Hear it'}
              </button>
            </div>
            <p className="hint">Plays the greeting below in this voice, from the same live model a caller hears. The first play of each voice takes a few seconds.</p>

            <label htmlFor="set-greeting">Greeting</label>
            <textarea id="set-greeting" rows={3} maxLength={300} value={form.greeting} onChange={(e) => set('greeting', e.target.value)} />
            <p className="hint">It must say it is an AI assistant, and on a demo line that it is a demo.</p>

            <label htmlFor="set-language">Language</label>
            <select id="set-language" value={form.language_code} onChange={(e) => set('language_code', e.target.value)}>
              <option value="en-GB">English (UK)</option>
              <option value="">Match the caller's language</option>
            </select>

            <fieldset>
              <legend>Reply speed</legend>
              {Object.entries(meta.reply_speeds).map(([k, v]) => (
                <label key={k}>
                  <input type="radio" name="speed" value={k} checked={form.reply_speed === k} onChange={() => set('reply_speed', k)} />
                  {v.label}
                </label>
              ))}
            </fieldset>

            <label htmlFor="set-model">Voice model</label>
            <select id="set-model" value={form.live_model} onChange={(e) => set('live_model', e.target.value)}>
              <option value="">Automatic ({meta.default_models.map((m) => labels[m] ?? m).join(', then ')})</option>
              {meta.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}, with the other as fallback
                </option>
              ))}
            </select>

            {error ? <p className="form-error" role="alert">{error}</p> : null}

            <footer>
              <span className="muted">Applies from the next call.</span>
              <button className="primary" type="button" id="set-save" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </footer>
          </>
        )}
      </form>
    </dialog>
  );
}
