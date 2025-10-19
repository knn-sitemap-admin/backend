import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: { credentialId: string; role: 'admin' | 'manager' | 'staff' };
  }
}
