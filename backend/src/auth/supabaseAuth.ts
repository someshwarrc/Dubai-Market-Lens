import type { HttpRequest } from '@azure/functions';
import { getRuntimeConfig } from '../config.js';

export type AuthenticatedReviewer = {
  userId: string;
  email: string;
};

type SupabaseUser = {
  id?: unknown;
  email?: unknown;
  email_confirmed_at?: unknown;
  app_metadata?: Record<string, unknown> | null;
};

export class AuthenticationError extends Error {
  constructor(message: string, public readonly status: 401 | 403 | 503) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

const bearerToken = (request: HttpRequest): string => {
  const authorization = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) throw new AuthenticationError('Sign in with an authorized Google account to review transactions.', 401);
  return match[1];
};

const normalizedRoles = (metadata: Record<string, unknown> | null | undefined): string[] => {
  const value = metadata?.review_role ?? metadata?.role;
  if (Array.isArray(value)) return value.map((role) => String(role).trim().toLowerCase());
  return value ? [String(value).trim().toLowerCase()] : [];
};

export const canReviewTransactions = (
  user: SupabaseUser,
  reviewerEmails: string[],
): user is SupabaseUser & { id: string; email: string } => {
  if (typeof user.id !== 'string' || typeof user.email !== 'string' || !user.email_confirmed_at) return false;
  const roles = normalizedRoles(user.app_metadata);
  return roles.includes('reviewer') || roles.includes('admin') || reviewerEmails.includes(user.email.toLowerCase());
};

export const authenticateReviewer = async (request: HttpRequest): Promise<AuthenticatedReviewer> => {
  const token = bearerToken(request);
  const { supabaseUrl, supabasePublishableKey, reviewerEmails } = getRuntimeConfig();
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new AuthenticationError('Transaction review authentication is not configured.', 503);
  }

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabasePublishableKey,
        authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new AuthenticationError('The sign-in service is temporarily unavailable.', 503);
  }

  if (!response.ok) {
    throw new AuthenticationError('Your sign-in session is invalid or has expired.', 401);
  }

  const user = await response.json() as SupabaseUser;
  if (!canReviewTransactions(user, reviewerEmails)) {
    throw new AuthenticationError('Your account is signed in but is not authorized to review transactions.', 403);
  }

  return { userId: user.id, email: user.email.toLowerCase() };
};
