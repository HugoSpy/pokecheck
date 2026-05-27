declare module 'passport-microsoft' {
  import { Strategy as PassportStrategy } from 'passport';

  interface MicrosoftStrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
    tenant?: string;
  }

  type VerifyCallback = (err: unknown, user?: unknown) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type VerifyFunction = (accessToken: string, refreshToken: string, profile: any, done: VerifyCallback) => void;

  class Strategy extends PassportStrategy {
    constructor(options: MicrosoftStrategyOptions, verify: VerifyFunction);
  }
}
