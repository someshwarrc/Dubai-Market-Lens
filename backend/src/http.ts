import type { HttpResponseInit } from '@azure/functions';
import { getRuntimeConfig } from './config.js';

export const corsHeaders = (): Record<string, string> => ({
  'access-control-allow-origin': getRuntimeConfig().allowedOrigin,
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, x-functions-key',
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  vary: 'Origin',
});

export const jsonResponse = (status: number, jsonBody: unknown, extraHeaders: Record<string, string> = {}): HttpResponseInit => ({
  status,
  jsonBody,
  headers: { ...corsHeaders(), ...extraHeaders },
});

export const optionsResponse = (): HttpResponseInit => ({ status: 204, headers: corsHeaders() });
