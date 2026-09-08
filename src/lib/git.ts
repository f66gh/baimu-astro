import { execFileSync } from 'node:child_process';

export function getLatestGitCommitDate(filePath?: string): Date | undefined {
	try {
		const args = ['log', '-1', '--format=%cI'];
		if (filePath) args.push('--follow', '--', filePath);
		const value = execFileSync('git', args, {
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
