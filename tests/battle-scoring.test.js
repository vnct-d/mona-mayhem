import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateStats, scoreBattle } from '../src/scripts/battle-scoring.ts';

function player(daily, totalContributions = daily.reduce((total, day) => total + day.count, 0)) {
	return {
		username: 'test-player',
		from: daily[0]?.date ?? '2025-01-01',
		to: daily.at(-1)?.date ?? '2025-12-31',
		rangeDays: daily.length,
		totalContributions,
		daily: daily.map((day) => ({ level: day.count > 0 ? 1 : 0, ...day })),
	};
}

test('zero contributions produce zero streaks, zero peak, and zero consistency', () => {
	const stats = calculateStats(player([
		{ date: '2025-01-01', count: 0 },
		{ date: '2025-06-01', count: 0 },
		{ date: '2025-12-31', count: 0 },
	]));

	assert.deepEqual(stats, {
		totalContributions: 0,
		longestStreak: 0,
		currentStreak: 0,
		peakDay: null,
		consistency: 0,
	});
});

test('longest streak includes consecutive days across month and year boundaries', () => {
	const stats = calculateStats(player([
		{ date: '2024-12-30', count: 1 },
		{ date: '2024-12-31', count: 3 },
		{ date: '2025-01-01', count: 2 },
		{ date: '2025-01-02', count: 1 },
		{ date: '2025-01-04', count: 5 },
	]));

	assert.equal(stats.longestStreak, 4);
});

test('identical player stats tie in every category and overall score', () => {
	const stats = calculateStats(player([
		{ date: '2025-04-01', count: 4 },
		{ date: '2025-04-02', count: 2 },
		{ date: '2025-04-03', count: 0 },
	], 6));
	const result = scoreBattle(stats, { ...stats, peakDay: stats.peakDay && { ...stats.peakDay } });

	assert.deepEqual(result.categories.map((category) => category.winner), ['tie', 'tie', 'tie', 'tie', 'tie']);
	assert.equal(result.playerOnePoints, 2.5);
	assert.equal(result.playerTwoPoints, 2.5);
	assert.equal(result.winner, 'tie');
});
