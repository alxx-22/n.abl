// Text messages. Without Twilio credentials every SMS is "simulated": stored
// and shown on the board, never sent. With them, it goes out through Twilio.

import type { Config } from '../config.ts';
import type { SmsSender } from '../core/tools.ts';

export class SimulatedSms implements SmsSender {
  async send(): Promise<'simulated'> {
    return 'simulated';
  }
}

export class TwilioSms implements SmsSender {
  private readonly cfg: NonNullable<Config['twilio']>;
  constructor(cfg: NonNullable<Config['twilio']>) {
    this.cfg = cfg;
  }

  async send(to: string, body: string): Promise<'sent' | 'failed'> {
    if (!this.cfg.smsFrom) return 'failed';
    const user = this.cfg.apiKey ?? this.cfg.accountSid;
    const pass = this.cfg.apiSecret ?? this.cfg.authToken;
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.cfg.accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: this.cfg.smsFrom, Body: body.slice(0, 600) }),
        signal: AbortSignal.timeout(10000),
      });
      return res.ok ? 'sent' : 'failed';
    } catch {
      return 'failed';
    }
  }
}

export function smsSender(config: Config): SmsSender {
  return config.twilio?.smsFrom ? new TwilioSms(config.twilio) : new SimulatedSms();
}
