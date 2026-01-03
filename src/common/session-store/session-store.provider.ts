import { Provider } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

export const SESSION_STORE = Symbol('SESSION_STORE');

type SessionStoreLike = {
  destroy: (sid: string, cb: (err?: unknown) => void) => void;
};

export const sessionStoreProvider: Provider = {
  provide: SESSION_STORE,
  inject: [HttpAdapterHost],
  useFactory: (host: HttpAdapterHost): SessionStoreLike | null => {
    const expressApp = host.httpAdapter.getInstance();
    return (expressApp.get('sessionStore') as SessionStoreLike) ?? null;
  },
};
