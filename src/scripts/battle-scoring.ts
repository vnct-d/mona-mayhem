export interface ContributionDay {
	date: string;
	count: number;
	level: number;
}

export interface ContributionData {
	username: string;
	from: string;
	to: string;
	totalContributions: number;
	rangeDays?: number;
	daily: ContributionDay[];
}

export interface PlayerStats {
	totalContributions: number;
	longestStreak: number;
	currentStreak: number;
	peakDay: ContributionDay | null;
	consistency: number;
}

export type StatCategory = 'total' | 'longest-streak' | 'current-streak' | 'peak-day' | 'consistency';
export type PlayerSide = 'one' | 'two';

export interface ScoredCategory {
	id: StatCategory;
	playerOneValue: number;
	playerTwoValue: number;
	winner: PlayerSide | 'tie';
}

export interface BattleScore {
	categories: ScoredCategory[];
	playerOnePoints: number;
	playerTwoPoints: number;
	winner: PlayerSide | 'tie';
}

export function calculateStats(player: ContributionData): PlayerStats {
	const days = [...player.daily].sort((first, second) => first.date.localeCompare(second.date));
	const activeDays = days.filter((day) => day.count > 0);
	let longestStreak = 0;
	let currentRun = 0;
	let previousDate: string | null = null;

	for (const day of days) {
		if (day.count <= 0) {
			currentRun = 0;
			previousDate = null;
			continue;
		}

		currentRun = previousDate && isNextDay(previousDate, day.date) ? currentRun + 1 : 1;
		longestStreak = Math.max(longestStreak, currentRun);
		previousDate = day.date;
	}

	const activeDates = new Set(activeDays.map((day) => day.date));
	const today = new Date();
	const todayString = toUtcDateString(today);
	const yesterday = new Date(today);
	yesterday.setUTCDate(yesterday.getUTCDate() - 1);
	let streakDate = activeDates.has(todayString)
		? today
		: activeDates.has(toUtcDateString(yesterday))
			? yesterday
			: null;
	let currentStreak = 0;

	while (streakDate && activeDates.has(toUtcDateString(streakDate))) {
		currentStreak += 1;
		streakDate.setUTCDate(streakDate.getUTCDate() - 1);
	}

	const peakDay = activeDays.reduce<ContributionDay | null>(
		(peak, day) => (peak === null || day.count > peak.count ? day : peak),
		null,
	);
	const daysInRange = player.rangeDays && player.rangeDays > 0 ? player.rangeDays : days.length;

	return {
		totalContributions: player.totalContributions,
		longestStreak,
		currentStreak,
		peakDay,
		consistency: daysInRange > 0 ? (activeDays.length / daysInRange) * 100 : 0,
	};
}

export function scoreBattle(playerOne: PlayerStats, playerTwo: PlayerStats): BattleScore {
	const categories: ScoredCategory[] = [
		{ id: 'total', playerOneValue: playerOne.totalContributions, playerTwoValue: playerTwo.totalContributions, winner: 'tie' },
		{ id: 'longest-streak', playerOneValue: playerOne.longestStreak, playerTwoValue: playerTwo.longestStreak, winner: 'tie' },
		{ id: 'current-streak', playerOneValue: playerOne.currentStreak, playerTwoValue: playerTwo.currentStreak, winner: 'tie' },
		{ id: 'peak-day', playerOneValue: playerOne.peakDay?.count ?? 0, playerTwoValue: playerTwo.peakDay?.count ?? 0, winner: 'tie' },
		{ id: 'consistency', playerOneValue: playerOne.consistency, playerTwoValue: playerTwo.consistency, winner: 'tie' },
	];
	let playerOnePoints = 0;
	let playerTwoPoints = 0;

	for (const category of categories) {
		if (category.playerOneValue > category.playerTwoValue) {
			category.winner = 'one';
			playerOnePoints += 1;
		} else if (category.playerTwoValue > category.playerOneValue) {
			category.winner = 'two';
			playerTwoPoints += 1;
		} else {
			playerOnePoints += 0.5;
			playerTwoPoints += 0.5;
		}
	}

	return {
		categories,
		playerOnePoints,
		playerTwoPoints,
		winner: playerOnePoints > playerTwoPoints ? 'one' : playerTwoPoints > playerOnePoints ? 'two' : 'tie',
	};
}

function isNextDay(previous: string, current: string): boolean {
	const nextDate = new Date(`${previous}T00:00:00Z`);
	nextDate.setUTCDate(nextDate.getUTCDate() + 1);
	return toUtcDateString(nextDate) === current;
}

function toUtcDateString(date: Date): string {
	return date.toISOString().slice(0, 10);
}
