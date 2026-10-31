// The evals call a real server, so start `next dev` if one isn't already up.
import { spawn } from 'node:child_process';

const url = process.env.EVAL_BASE_URL ?? 'http://localhost:3000';
const isUp = () => fetch(url).then(() => true, () => false);

export default async function setup() {
	if (await isUp()) return;
	const server = spawn('npx', ['next', 'dev'], { stdio: 'ignore' });
	for (let i = 0; i < 60 && !(await isUp()); i++) await new Promise((r) => setTimeout(r, 1000));
	return () => void server.kill();
}
