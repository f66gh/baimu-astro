import { execFileSync } from 'node:child_process';

let isShallow = false;
try {
	isShallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore'],
	}).trim() === 'true';
} catch {
	console.warn('Git history is unavailable; article update dates will fall back to publication dates.');
}

// Deployment providers may clone only recent commits. Older articles need full history.
if (isShallow) {
	execFileSync('git', ['fetch', '--unshallow'], { stdio: 'inherit' });
}
