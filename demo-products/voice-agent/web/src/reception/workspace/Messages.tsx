// The back office's messages: callbacks the receptionist took, to mark done,
// and every text it sent.

import { demoApi } from '../../api.ts';
import { toast } from '../../components/Toaster.tsx';
import type { LiveState } from '../types.ts';

export function Messages({ id, state, onDone }: { id: string; state: LiveState; onDone: () => void }) {
  const callbacks = state.messages.filter((m) => m.kind === 'message');
  const texts = state.messages.filter((m) => m.kind === 'sms');
  const mark = async (mid: string, status: 'read' | 'new') => {
    try {
      await demoApi(`/workspaces/${id}/messages/${mid}`, { method: 'PATCH', json: { status } });
      onDone();
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <div className="ws-messages">
      <h3>Callbacks and messages</h3>
      {callbacks.length ? callbacks.map((m) => (
        <div className={`message ${m.status === 'read' ? 'done' : ''}`} key={m.id}>
          <span className="from">{m.from_name ?? 'A caller'}</span>
          {m.from_phone ? <span className="muted"> · {m.from_phone}</span> : null}
          <div>{m.body}</div>
          <button type="button" className="small" onClick={() => mark(m.id, m.status === 'read' ? 'new' : 'read')}>{m.status === 'read' ? 'Mark not done' : 'Mark done'}</button>
        </div>
      )) : <p className="empty">No messages. The receptionist takes one when a caller needs a person.</p>}
      <h3>Texts sent</h3>
      {texts.length ? texts.map((m) => (
        <div className="message" key={m.id}>
          <span className="muted">To {m.to_number}</span>
          <div>{m.body}</div>
        </div>
      )) : <p className="empty">No texts yet.</p>}
    </div>
  );
}
