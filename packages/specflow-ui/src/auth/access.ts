import type { AuthSessionResponse } from '@nevo/specflow-contracts/authentication';
import type { AuthStore } from './store';
import { safeReturnTo } from './LoginScreen';

export { safeReturnTo };

export type AppAccessDecision =
  | { readonly kind: 'allow' }
  | { readonly kind: 'login'; readonly returnTo: string }
  | { readonly kind: 'runtime-unavailable'; readonly returnTo: string };

export type LoginAccessDecision =
  | { readonly kind: 'allow' }
  | { readonly kind: 'app'; readonly returnTo: string }
  | { readonly kind: 'runtime-unavailable'; readonly returnTo: string };

/**
 * Resolves access policy for authenticated app shell routes.
 */
export async function resolveAppAccess(
  auth: AuthStore,
  returnTo: string,
): Promise<AppAccessDecision> {
  const safeTarget = safeReturnTo(returnTo);
  let session: AuthSessionResponse;

  try {
    session = await auth.ensureSession();
  } catch {
    return { kind: 'runtime-unavailable', returnTo: safeTarget };
  }

  return session.authenticationRequired && !session.authenticated
    ? { kind: 'login', returnTo: safeTarget }
    : { kind: 'allow' };
}

/**
 * Resolves access policy for the login route.
 */
export async function resolveLoginAccess(
  auth: AuthStore,
  returnTo: string | undefined,
): Promise<LoginAccessDecision> {
  const safeTarget = safeReturnTo(returnTo);
  let session: AuthSessionResponse;

  try {
    session = await auth.ensureSession();
  } catch {
    return { kind: 'runtime-unavailable', returnTo: safeTarget };
  }

  return !session.authenticationRequired || session.authenticated
    ? { kind: 'app', returnTo: safeTarget }
    : { kind: 'allow' };
}
