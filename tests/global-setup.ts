import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { rmSync } from 'node:fs';

let server: Server;

export async function setup() {
  const body = readFileSync(new URL('./fixtures/episodes.json', import.meta.url));
  server = createServer((_req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(body);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  rmSync('dist', { recursive: true, force: true });
  await promisify(exec)('npx astro build', {
    env: { ...process.env, EPISODES_API_URL: `http://127.0.0.1:${port}/episodes` },
  });
}

export async function teardown() {
  await new Promise((r) => server.close(r));
}
