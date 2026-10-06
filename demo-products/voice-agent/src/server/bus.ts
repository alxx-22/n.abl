// In-process fan-out of board events: a call publishes, every board open on
// that tenant receives it over server-sent events. One process, no Redis:
// a demo runs on one machine.

import { EventEmitter } from 'node:events';
import type { BoardEvent, CallNote } from '../core/call.ts';

export class Bus {
  private readonly emitter = new EventEmitter();
  private active = new Map<string, { tenant_id: string; channel: string; started: number }>();

  constructor() {
    this.emitter.setMaxListeners(200);
  }

  publish = (e: BoardEvent): void => {
    if (e.type === 'call_started') this.active.set(e.call_id, { tenant_id: e.tenant_id, channel: String(e.channel), started: Date.now() });
    if (e.type === 'call_ended') this.active.delete(e.call_id);
    this.emitter.emit(`tenant:${e.tenant_id}`, e);
  };

  subscribe(tenantId: string, fn: (e: BoardEvent) => void): () => void {
    const key = `tenant:${tenantId}`;
    this.emitter.on(key, fn);
    return () => this.emitter.off(key, fn);
  }

  /** Something that happened off the call (an approval pressed, a page accepted), for any call on that business. */
  note(tenantId: string, n: CallNote): void {
    this.emitter.emit(`note:${tenantId}`, n);
  }

  onNote(tenantId: string, fn: (n: CallNote) => void): () => void {
    const key = `note:${tenantId}`;
    this.emitter.on(key, fn);
    return () => this.emitter.off(key, fn);
  }

  activeCalls(): number {
    return this.active.size;
  }

  activeFor(tenantId: string): string[] {
    return [...this.active.entries()].filter(([, v]) => v.tenant_id === tenantId).map(([k]) => k);
  }
}
