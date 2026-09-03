/**
 * Runs the API/WebSocket server and the Vite dev server side by side,
 * so `npm run dev` at the repo root is all anyone needs.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const children = [
  { name: 'server', color: '\x1b[35m', args: ['run', 'dev', '-w', 'server'] },
  { name: 'client', color: '\x1b[36m', args: ['run', 'dev', '-w', 'client'] },
].map(({ name, color, args }) => {
  const child = spawn(npm, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  const prefix = `${color}[${name}]\x1b[0m `;
  const pipe = (stream, out) => {
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      out.write(
        chunk
          .split('\n')
          .filter((line, i, all) => line.trim() || i < all.length - 1)
          .map((line) => prefix + line)
          .join('\n') + '\n',
      );
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  return child;
});

const stop = () => {
  for (const child of children) child.kill('SIGINT');
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) child.on('exit', (code) => code && stop());
