import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GET, flattenContributionDays, isValidGitHubUsername } from '../src/pages/api/contributions/[username].ts';

test('parser preserves zero-contribution days and their intensity', () => {
	const days = flattenContributionDays([
		{
			first_day: '2025-01-01',
			contribution_days: [
				{ weekday: 0, count: 0, level: 0 },
				{ weekday: 1, count: 0, level: 0 },
			],
		},
	]);

	assert.deepEqual(days, [
		{ date: '2025-01-01', weekday: 0, count: 0, level: 0 },
		{ date: '2025-01-02', weekday: 1, count: 0, level: 0 },
	]);
});

test('parser handles missing optional week and day values safely', () => {
	assert.deepEqual(flattenContributionDays([{}, { first_day: '2025-02-01' }]), []);
	assert.deepEqual(flattenContributionDays([{ first_day: '2025-02-01', contribution_days: [{}] }]), [
		{ date: '2025-02-01', weekday: 0, count: 0, level: 0 },
	]);
});

test('rejects invalid GitHub usernames before making an upstream request', async () => {
	const invalidUsernames = ['-octocat', 'octocat-', 'bad/name', 'contains space', 'a'.repeat(40), ''];
	for (const username of invalidUsernames) {
		assert.equal(isValidGitHubUsername(username), false, `expected "${username}" to be invalid`);
		const response = await GET({ params: { username } });
		assert.equal(response.status, 400, `expected "${username}" to return 400`);
	}
});
