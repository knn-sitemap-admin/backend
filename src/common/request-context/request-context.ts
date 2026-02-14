import { AsyncLocalStorage } from 'async_hooks';

export type RequestContextStore = {
  requestId: string;
  queries: string[];
};

export const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function getReqStore(): RequestContextStore | null {
  return requestContext.getStore() ?? null;
}
