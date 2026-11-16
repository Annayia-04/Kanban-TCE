/**
 * Lance une instance locale « comme en production » ou « comme en staging ».
 *
 *   npm run start:prod     # projet vide, données dans ./data-prod, port 4321
 *   npm run start:staging  # démo, données dans ./data-staging, port 4322
 *
 * Les variables déjà définies (PORT, KANBAN_DATA_DIR, KANBAN_AUTH_MODE…) sont respectées.
 */
import { spawn } from 'node:child_process';

const mode = process.argv[2] === 'staging' ? 'staging' : 'prod';
const env = { ...process.env };

if (mode === 'staging') {
  env.KANBAN_SEED = env.KANBAN_SEED || 'demo';
  env.KANBAN_DATA_DIR = env.KANBAN_DATA_DIR || 'data-staging';
  env.PORT = env.PORT || '4322';
} else {
  env.KANBAN_SEED = env.KANBAN_SEED || 'empty';
  env.KANBAN_DATA_DIR = env.KANBAN_DATA_DIR || 'data-prod';
  env.PORT = env.PORT || '4321';
}

console.log(
  `Flowboard ${mode} — http://127.0.0.1:${env.PORT} — données : ${env.KANBAN_DATA_DIR} — seed : ${env.KANBAN_SEED}`
);

const child = spawn(process.execPath, ['server.js'], { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 0));
