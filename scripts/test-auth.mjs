/**
 * Tests du SSO Google (verification d'id_token, sessions, restrictions de domaine).
 * Aucun appel reseau : les cles JWKS sont generees localement et injectees.
 */
import crypto from 'node:crypto';
import {
  verifyIdToken,
  emailAllowed,
  signSession,
  verifySession,
  parseCookies,
  serializeCookie,
  buildAuthUrl,
  SESSION_COOKIE,
} from '../lib/google-auth.js';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };
const jwks = [publicJwk];
const CLIENT_ID = 'client-test.apps.googleusercontent.com';
const now = Date.now();
const seconds = Math.floor(now / 1000);

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

function makeToken(claims, header = { alg: 'RS256', kid: 'test-key' }) {
  const h = b64(header);
  const p = b64(claims);
  const signature = crypto.sign('RSA-SHA256', Buffer.from(`${h}.${p}`), privateKey).toString('base64url');
  return `${h}.${p}.${signature}`;
}

const claims = {
  iss: 'https://accounts.google.com',
  aud: CLIENT_ID,
  sub: '1234567890',
  email: 'marie@studio.fr',
  email_verified: true,
  hd: 'studio.fr',
  name: 'Marie Lefèvre',
  iat: seconds,
  exp: seconds + 3600,
  nonce: 'nonce-123',
};

const failures = [];
const check = (label, ok) => {
  if (!ok) failures.push(label);
};
const expectThrow = async (label, token, options = {}) => {
  try {
    await verifyIdToken(token, { clientId: CLIENT_ID, jwks, now, ...options });
    failures.push(`${label} : aucune erreur levée`);
  } catch {
    /* attendu */
  }
};

/* --- 1. Jeton valide --- */
const payload = await verifyIdToken(makeToken(claims), { clientId: CLIENT_ID, jwks, now });
check('email extrait du jeton', payload.email === 'marie@studio.fr');
check('hd (domaine Workspace) extrait', payload.hd === 'studio.fr');

/* --- 2. Rejets --- */
await expectThrow('jeton expiré', makeToken({ ...claims, exp: seconds - 10 }));
await expectThrow('mauvais audience', makeToken({ ...claims, aud: 'autre-client' }));
await expectThrow('mauvais émetteur', makeToken({ ...claims, iss: 'https://evil.example' }));
await expectThrow('email non vérifié', makeToken({ ...claims, email_verified: false }));
await expectThrow('algorithme interdit', makeToken({ ...claims, alg: 'none' }, { alg: 'none', kid: 'test-key' }));

const tampered = makeToken(claims).split('.');
tampered[1] = b64({ ...claims, email: 'pirate@evil.example' });
await expectThrow('signature invalide', tampered.join('.'));

await expectThrow('clé inconnue', makeToken(claims, { alg: 'RS256', kid: 'autre-cle' }));

/* --- 3. Restrictions de domaine --- */
check('domaine autorisé (email)', emailAllowed('marie@studio.fr', '', ['studio.fr']));
check('domaine refusé (email)', !emailAllowed('marie@gmail.com', '', ['studio.fr']));
check('HD Workspace accepté', emailAllowed('marie@alias.fr', 'studio.fr', ['studio.fr']));
check('aucun domaine = tout autorisé', emailAllowed('qui@importe.fr', '', []));
check('domaine avec @ toléré', emailAllowed('marie@studio.fr', '', ['@studio.fr']));

/* --- 4. Sessions signées --- */
const secret = crypto.randomBytes(32).toString('hex');
const session = signSession({ email: 'marie@studio.fr' }, secret, 60_000);
const read = verifySession(session, secret);
check('session relue', read?.email === 'marie@studio.fr');
check('session altérée rejetée', verifySession(`${session}x`, secret) === null);
check('session avec un autre secret rejetée', verifySession(session, 'autre-secret') === null);
check('session expirée rejetée', verifySession(signSession({ email: 'a@b.fr' }, secret, -1000), secret) === null);
check('cookie absent rejeté', verifySession(undefined, secret) === null);

/* --- 5. Cookies --- */
const cookies = parseCookies(`${SESSION_COOKIE}=abc.def; autre=1`);
check('cookie de session lu', cookies[SESSION_COOKIE] === 'abc.def');
check('cookie autre lu', cookies.autre === '1');
const cookie = serializeCookie(SESSION_COOKIE, 'valeur', { maxAge: 60, secure: true });
check('cookie HttpOnly', /HttpOnly/i.test(cookie));
check('cookie Secure', /Secure/i.test(cookie));
check('cookie SameSite', /SameSite=Lax/i.test(cookie));

/* --- 6. URL d'autorisation --- */
const url = new URL(
  buildAuthUrl({ clientId: CLIENT_ID, redirectUri: 'https://kanban.example/auth/callback', state: 's1', nonce: 'n1' })
);
check('endpoint Google', url.origin === 'https://accounts.google.com');
check('client_id transmis', url.searchParams.get('client_id') === CLIENT_ID);
check('redirect_uri transmis', url.searchParams.get('redirect_uri') === 'https://kanban.example/auth/callback');
check('scope OIDC', url.searchParams.get('scope') === 'openid email profile');
check('state transmis', url.searchParams.get('state') === 's1');
check('nonce transmis', url.searchParams.get('nonce') === 'n1');
check('pas de prompt implicite', url.searchParams.get('prompt') === 'select_account');

if (failures.length) {
  console.error(`${failures.length} échec(s) :`);
  for (const failure of failures) console.error(' -', failure);
  process.exitCode = 1;
} else {
  console.log('OK — SSO Google (jetons, sessions, domaines) conforme.');
}
