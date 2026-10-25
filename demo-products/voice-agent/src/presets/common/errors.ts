// A request the answers cannot take, from a preset hook (a draft with nothing
// to go on, two tables that cannot be joined). Presets know nothing of HTTP;
// the server answers with this status and message.

export class PresetError extends Error {
  /** 400: the request makes no sense. 409: it clashes with the setup as it is. */
  readonly status: 400 | 409;
  constructor(status: 400 | 409, message: string) {
    super(message);
    this.status = status;
  }
}
