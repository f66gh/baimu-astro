import { execFileSync } from 'node:child_process';

export function getLatestGitCommitDate(): Date | undefined {
	try {
		const value = execFileSync('git', ['log', '-1', '--format=%cI'], {
			cwd: process.cwd(),
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		}).trim();

		const date = new Date(value);
		return Number.isNaN(date.valueOf()) ? undefined : date;
	} catch {
		return undefined;
	}
}
