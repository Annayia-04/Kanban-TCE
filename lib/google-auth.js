/**
 * Connexion Google (OAuth 2.0 / OpenID Connect) sans dependance externe.
 *
 * Flux "authorization code" cote serveur :
 *   1. /auth/login   -> redirection vers accounts.google.com (state + nonce signes)
 *   2. /auth/callback -> echange du code contre un id_token
 *   3. verification locale de la signature RS256 avec les cles JWKS de Google
 *   4. session signee (HMAC-SHA256) dans un cookie HttpOnly
 *
 * Aucun paquet npm : crypto et fetch natifs de Node 18+.
 */
import crypto from 'node:crypto';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

export const SESSION_COOKIE = 'fb_session';
export const OAUTH_COOKIE = 'fb_oauth';

const jwksCache = { keys: [], at: 0 };

export function googleConfigured(env = process.env) {
  return Boolean(String(env.GOOGLE_CLIENT_ID || '').trim() && String(env.GOOGLE_CLIENT_SECRET || '').trim());
}

export function buildAuthUrl({ clientId, redirectUri, state, nonce, loginHint }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    access_type: 'online',
    include_granted_scopes: 'true',
    prompt: 'select_account',
  });
  if (loginHint) params.set('login_hint', loginHint);
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeCode({ code, clientId, clientSecret, redirectUri, fetchImpl = fetch }) {
  const res = await fetchImpl(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error_description || data.error || `Échange du code refusé (${res.status}).`);
  }
  if (!data.id_token) throw new Error('Réponse Google sans id_token.');
  return data;
}

export async function getJwks({ fetchImpl = fetch, force = false, ttlMs = 3600_000 } = {}) {
  const now = Date.now();
  if (!force && jwksCache.keys.length && now - jwksCache.at < ttlMs) return jwksCache;
  const res = await fetchImpl(JWKS_URL);
  if (!res.ok) throw new Error(`Clés Google inaccessibles (${res.status}).`);
  const data = await res.json();
  if (!Array.isArray(data.keys) || !data.keys.length) throw new Error('Réponse JWKS invalide.');
  jwksCache.keys = data.keys;
  jwksCache.at = now;
  return jwksCache;
}

function decodePart(part) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

/**
 * Verifie un id_token Google et retourne ses claims.
 * `jwks` permet d'injecter les cles (tests) ; sinon elles sont recuperees et mises en cache.
 */
export async function verifyIdToken(token, { clientId, jwks, fetchImpl = fetch, now = Date.now() } = {}) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Jeton Google invalide.');
  const [rawHeader, rawPayload, rawSignature] = parts;

  let header;
  let claims;
  try {
    header = decodePart(rawHeader);
    claims = decodePart(rawPayload);
  } catch {
    throw new Error('Jeton Google illisible.');
  }
  if (header.alg !== 'RS256') throw new Error(`Algorithme de jeton non supporté (${header.alg || '?'}).`);

  const keys = jwks || (await getJwks({ fetchImpl })).keys;
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk && !jwks) {
    // Rotation de cles : on force un rafraichissement une fois.
    jwk = (await getJwks({ fetchImpl, force: true })).keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) throw new Error('Clé de signature Google inconnue.');

  let valid = false;
  try {
    const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    valid = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${rawHeader}.${rawPayload}`),
      key,
      Buffer.from(rawSignature, 'base64url')
    );
  } catch {
    valid = false;
  }
  if (!valid) throw new Error('Signature du jeton Google invalide.');

  if (!ISSUERS.has(String(claims.iss || ''))) throw new Error('Émetteur du jeton inattendu.');
  if (clientId && String(claims.aud || '') !== String(clientId)) throw new Error('Jeton Google destiné à un autre client.');
  const seconds = Math.floor(now / 1000);
  if (!claims.exp || Number(claims.exp) < seconds) throw new Error('Jeton Google expiré.');
  if (claims.iat && Number(claims.iat) > seconds + 300) throw new Error('Jeton Google daté dans le futur.');
  if (claims.email_verified !== true && claims.email_verified !== 'true') {
    throw new Error('Adresse email Google non vérifiée.');
  }
  if (!claims.email) throw new Error('Jeton Google sans adresse email.');
  return claims;
}

/** Vrai si l'email (ou le domaine Workspace `hd`) est autorise. */
export function emailAllowed(email, hd, domains = []) {
  if (!domains.length) return true;
  const value = String(email || '').toLowerCase();
  const hosted = String(hd || '').toLowerCase();
  return domains.some((domain) => {
    const d = String(domain || '').toLowerCase().replace(/^@/, '');
    return Boolean(d) && (value === d || value.endsWith(`@${d}`) || hosted === d);
  });
}

/* ------------------------------------------------------------------ */
/* Sessions signees (cookie)                                           */
/* ------------------------------------------------------------------ */

export function signSession(payload, secret, ttlMs) {
  const body = { ...payload, exp: Date.now() + ttlMs };
  const data = Buffer.from(JSON.stringify(body)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function verifySession(token, secret, now = Date.now()) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [data, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  const a = Buffer.from(String(signature));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload || typeof payload !== 'object') return null;
    if (!payload.exp || Number(payload.exp) < now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    if (!name) continue;
    let value = part.slice(i + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      /* valeur brute */
    }
    out[name] = value;
  }
  return out;
}

export function serializeCookie(name, value, { maxAge, secure, sameSite = 'Lax' } = {}) {
  const parts = [`${name}=${value}`, 'Path=/', `SameSite=${sameSite}`, 'HttpOnly'];
  if (secure) parts.push('Secure');
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  return parts.join('; ');
}
