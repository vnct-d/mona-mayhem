import { isMuted, playCoinClick, playPowerUp, playStatHit, playVictoryFanfare, setMuted } from './arcade-sfx';
import { calculateStats, scoreBattle, type ContributionData, type ContributionDay, type PlayerSide, type StatCategory } from './battle-scoring';

interface DisplayCategory {
	id: StatCategory;
	playerOneValue: number;
	playerTwoValue: number;
	playerOneDisplay: string;
	playerTwoDisplay: string;
	winner: PlayerSide | 'tie';
}

interface ApiError {
	error?: string;
}

const form = document.querySelector<HTMLFormElement>('#battle-form');
const playerOneInput = document.querySelector<HTMLInputElement>('#player-one');
const playerTwoInput = document.querySelector<HTMLInputElement>('#player-two');
const battleButton = document.querySelector<HTMLButtonElement>('#battle-button');
const battleStatus = document.querySelector<HTMLParagraphElement>('#battle-status');
const battleArena = document.querySelector<HTMLElement>('#battle-arena');
const loadingArena = document.querySelector<HTMLElement>('#loading-arena');

form?.addEventListener('submit', (event) => {
	event.preventDefault();
	playCoinClick();
	void loadBattle();
});

const sfxToggle = document.querySelector<HTMLButtonElement>('#sfx-toggle');
sfxToggle?.addEventListener('click', () => {
	const nextMutedState = !isMuted();
	setMuted(nextMutedState);
	sfxToggle.textContent = nextMutedState ? '🔇 SFX: OFF' : '🔊 SFX: ON';
	sfxToggle.setAttribute('aria-pressed', String(!nextMutedState));
});

document.querySelectorAll<HTMLButtonElement>('[data-player-one][data-player-two]').forEach((button) => {
	button.addEventListener('click', () => {
		if (!playerOneInput || !playerTwoInput || !form || battleButton?.disabled) {
			return;
		}

		playCoinClick();
		playerOneInput.value = button.dataset.playerOne ?? '';
		playerTwoInput.value = button.dataset.playerTwo ?? '';
		void loadBattle();
	});
});

const sharedBattle = new URLSearchParams(window.location.search);
const sharedPlayerOne = sharedBattle.get('p1')?.trim();
const sharedPlayerTwo = sharedBattle.get('p2')?.trim();
if (sharedPlayerOne && sharedPlayerTwo && playerOneInput && playerTwoInput) {
	playerOneInput.value = sharedPlayerOne;
	playerTwoInput.value = sharedPlayerTwo;
	void loadBattle();
}

async function loadBattle(): Promise<void> {
	if (!playerOneInput || !playerTwoInput || !battleButton || !battleStatus || !battleArena || !loadingArena) {
		return;
	}

	const usernames = [playerOneInput.value.trim(), playerTwoInput.value.trim()];
	if (usernames.some((username) => username.length === 0)) {
		battleArena.hidden = true;
		loadingArena.hidden = true;
		const hud = document.querySelector<HTMLElement>('#battle-hud');
		if (hud) {
			hud.hidden = true;
		}
		showError('Enter both GitHub usernames to start a battle.');
		return;
	}
	if (battleButton.disabled) {
		return;
	}

	syncBattleUrl(usernames[0], usernames[1]);

	battleArena.hidden = true;
	loadingArena.hidden = false;
	const hud = document.querySelector<HTMLElement>('#battle-hud');
	if (hud) {
		hud.hidden = true;
	}
	battleButton.disabled = true;
	battleStatus.textContent = 'FIGHT! Loading contribution data…';
	battleStatus.dataset.state = 'loading';

	try {
		const [fetchResult, countdownResult] = await Promise.allSettled([
			Promise.all(usernames.map(fetchContributions)),
			runCountdown(usernames[0], usernames[1]),
		]);
		if (fetchResult.status === 'rejected') {
			throw fetchResult.reason;
		}
		if (countdownResult.status === 'rejected') {
			throw countdownResult.reason;
		}
		const players = fetchResult.value as [ContributionData, ContributionData];

		if (!hud) {
			throw new Error('The battle power display is unavailable.');
		}

		renderPlayer(players[0], 'one');
		renderPlayer(players[1], 'two');
		loadingArena.hidden = true;
		battleArena.hidden = false;
		playPowerUp();
		await Promise.all([
			animateHeatmap(document.querySelector<HTMLOListElement>('#player-one-grid')),
			animateHeatmap(document.querySelector<HTMLOListElement>('#player-two-grid')),
		]);
		hud.hidden = false;
		await renderScoreboard(players[0], players[1]);
		battleStatus.textContent = 'MATCH COMPLETE';
		battleStatus.dataset.state = 'success';
	} catch (error) {
		const countdownScreen = document.querySelector<HTMLElement>('#battle-countdown');
		if (countdownScreen) {
			countdownScreen.hidden = true;
		}
		loadingArena.hidden = true;
		battleArena.hidden = true;
		if (hud) {
			hud.hidden = true;
		}
		showError(error instanceof Error ? error.message : 'Unable to load contribution data. Please try again.');
	} finally {
		battleButton.disabled = false;
	}
}

async function runCountdown(playerOne: string, playerTwo: string): Promise<void> {
	const screen = document.querySelector<HTMLElement>('#battle-countdown');
	const firstName = document.querySelector<HTMLElement>('#countdown-player-one');
	const secondName = document.querySelector<HTMLElement>('#countdown-player-two');
	const number = document.querySelector<HTMLElement>('#countdown-number');
	const caption = document.querySelector<HTMLElement>('#countdown-caption');

	if (!screen || !firstName || !secondName || !number || !caption) {
		throw new Error('The battle countdown is unavailable.');
	}

	firstName.textContent = playerOne.toUpperCase();
	secondName.textContent = playerTwo.toUpperCase();
	screen.hidden = false;
	caption.textContent = 'GET READY';
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	for (const step of ['3', '2', '1', 'FIGHT!']) {
		number.textContent = step;
		number.classList.remove('countdown-pop');
		void number.offsetWidth;
		number.classList.add('countdown-pop');
		await delay(reducedMotion ? 50 : step === 'FIGHT!' ? 500 : 650);
	}

	screen.hidden = true;
}

async function fetchContributions(username: string): Promise<ContributionData> {
	const response = await fetch(`/api/contributions/${encodeURIComponent(username)}`);
	const payload = (await response.json()) as ContributionData & ApiError;

	if (response.status === 404) {
		throw new Error(`GitHub user "${username}" was not found. Check the username and try again.`);
	}

	if (!response.ok) {
		throw new Error(payload.error ?? `Could not load contribution data for "${username}".`);
	}

	if (!Array.isArray(payload.daily)) {
		throw new Error(`Contribution data for "${username}" is incomplete.`);
	}

	return payload;
}

function renderPlayer(player: ContributionData, playerNumber: 'one' | 'two'): void {
	const name = document.querySelector<HTMLElement>(`#player-${playerNumber}-name`);
	const avatar = document.querySelector<HTMLImageElement>(`#player-${playerNumber}-avatar`);
	const summary = document.querySelector<HTMLElement>(`#player-${playerNumber}-summary`);
	const grid = document.querySelector<HTMLOListElement>(`#player-${playerNumber}-grid`);

	if (!name || !avatar || !summary || !grid) {
		throw new Error('The battle arena is missing a player display.');
	}

	name.textContent = player.username;
	avatar.src = `https://github.com/${encodeURIComponent(player.username)}.png?size=96`;
	avatar.alt = `${player.username} GitHub avatar`;
	summary.textContent = `${player.totalContributions.toLocaleString()} contributions · ${formatDate(player.from)} – ${formatDate(player.to)}`;
	const fighterClass = document.querySelector<HTMLElement>(`#player-${playerNumber}-class`);
	if (!fighterClass) {
		throw new Error('The player card is missing its fighter class badge.');
	}
	fighterClass.textContent = getFighterClass(player);
	renderHeatmap(grid, player);
}

function getFighterClass(player: ContributionData): string {
	const stats = calculateStats(player);
	const totalContributions = player.daily.reduce((total, day) => total + day.count, 0);
	const weekendContributions = player.daily.reduce((total, day) => {
		const weekday = new Date(`${day.date}T00:00:00Z`).getUTCDay();
		return total + (weekday === 0 || weekday === 6 ? day.count : 0);
	}, 0);
	const weekendRatio = totalContributions > 0 ? weekendContributions / totalContributions : 0;
	const averagePerDay = player.daily.length > 0 ? totalContributions / player.daily.length : 0;
	const peakCount = stats.peakDay?.count ?? 0;

	if (stats.longestStreak > 30) {
		return '🛡️ Streak Paladin';
	}
	if (weekendRatio >= 0.4 && weekendContributions > 0) {
		return '⚔️ Weekend Warrior';
	}
	if (peakCount >= Math.max(10, averagePerDay * 4)) {
		return '🔥 Commit Berserker';
	}
	if (stats.consistency >= 50) {
		return '✨ Contribution Sage';
	}
	return '🕹️ Grid Guardian';
}

function syncBattleUrl(playerOne: string, playerTwo: string): void {
	const url = new URL(window.location.href);
	url.searchParams.set('p1', playerOne);
	url.searchParams.set('p2', playerTwo);
	window.history.replaceState(null, '', url);
}

function renderHeatmap(grid: HTMLOListElement, player: ContributionData): void {
	const days = [...player.daily].sort((first, second) => first.date.localeCompare(second.date)).slice(-52 * 7);
	const cells = days.map((day, index) => {
		const cell = document.createElement('li');
		const level = Math.min(4, Math.max(0, Math.trunc(day.level)));

		cell.className = 'contribution-cell';
		cell.dataset.level = String(level);
		cell.dataset.week = String(Math.floor(index / 7));
		cell.dataset.revealed = 'false';
		cell.title = `${day.date}: ${day.count} contributions`;
		cell.setAttribute('aria-label', `${day.date}: ${day.count} contributions`);
		return cell;
	});

	grid.replaceChildren(...cells);
	grid.setAttribute('aria-label', `${player.username} contribution activity for the past 52 weeks`);
}

async function animateHeatmap(grid: HTMLOListElement | null): Promise<void> {
	if (!grid) {
		throw new Error('A contribution grid is missing from the battle arena.');
	}

	const cells = grid.querySelectorAll<HTMLElement>('.contribution-cell');
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		cells.forEach((cell) => {
			cell.dataset.revealed = 'true';
		});
		return;
	}

	for (let week = 0; week < 52; week += 1) {
		grid.querySelectorAll<HTMLElement>(`[data-week="${week}"]`).forEach((cell) => {
			cell.dataset.revealed = 'true';
		});
		await delay(24);
	}
}

async function renderScoreboard(playerOne: ContributionData, playerTwo: ContributionData): Promise<void> {
	const statsOne = calculateStats(playerOne);
	const statsTwo = calculateStats(playerTwo);
	const categoryDisplays: Record<StatCategory, [string, string]> = {
		total: [statsOne.totalContributions.toLocaleString(), statsTwo.totalContributions.toLocaleString()],
		'longest-streak': [`${statsOne.longestStreak} days`, `${statsTwo.longestStreak} days`],
		'current-streak': [`${statsOne.currentStreak} days`, `${statsTwo.currentStreak} days`],
		'peak-day': [formatPeakDay(statsOne.peakDay), formatPeakDay(statsTwo.peakDay)],
		consistency: [`${statsOne.consistency.toFixed(1)}%`, `${statsTwo.consistency.toFixed(1)}%`],
	};
	const scoredBattle = scoreBattle(statsOne, statsTwo);
	const categories: DisplayCategory[] = scoredBattle.categories.map((category) => ({
		...category,
		playerOneDisplay: categoryDisplays[category.id][0],
		playerTwoDisplay: categoryDisplays[category.id][1],
	}));

	const playerOneColumn = document.querySelector<HTMLElement>('#player-one-column');
	const playerTwoColumn = document.querySelector<HTMLElement>('#player-two-column');
	const playerOneScoreLabel = document.querySelector<HTMLElement>('#player-one-score-label');
	const playerTwoScoreLabel = document.querySelector<HTMLElement>('#player-two-score-label');
	const playerOneScore = document.querySelector<HTMLElement>('#player-one-score');
	const playerTwoScore = document.querySelector<HTMLElement>('#player-two-score');
	const winnerBanner = document.querySelector<HTMLElement>('#winner-banner');
	const hudPlayerOne = document.querySelector<HTMLElement>('#hud-player-one');
	const hudPlayerTwo = document.querySelector<HTMLElement>('#hud-player-two');
	const hudScoreOne = document.querySelector<HTMLElement>('#hud-score-one');
	const hudScoreTwo = document.querySelector<HTMLElement>('#hud-score-two');

	if (
		!playerOneColumn ||
		!playerTwoColumn ||
		!playerOneScoreLabel ||
		!playerTwoScoreLabel ||
		!playerOneScore ||
		!playerTwoScore ||
		!winnerBanner ||
		!hudPlayerOne ||
		!hudPlayerTwo ||
		!hudScoreOne ||
		!hudScoreTwo
	) {
		throw new Error('The battle scoreboard is incomplete.');
	}

	playerOneColumn.textContent = playerOne.username;
	playerTwoColumn.textContent = playerTwo.username;
	playerOneScoreLabel.textContent = playerOne.username;
	playerTwoScoreLabel.textContent = playerTwo.username;
	hudPlayerOne.textContent = playerOne.username.toUpperCase();
	hudPlayerTwo.textContent = playerTwo.username.toUpperCase();
	playerOneScore.textContent = '0';
	playerTwoScore.textContent = '0';
	hudScoreOne.textContent = '0';
	hudScoreTwo.textContent = '0';
	winnerBanner.textContent = '';
	delete winnerBanner.dataset.result;
	winnerBanner.classList.remove('victory-animation');
	updatePowerBar('one', 0);
	updatePowerBar('two', 0);

	let playerOnePoints = 0;
	let playerTwoPoints = 0;
	const categoryWinners: Array<{ id: StatCategory; winner: PlayerSide | 'tie' }> = [];

	for (const category of categories) {
		const row = document.querySelector<HTMLTableRowElement>(`[data-stat-row="${category.id}"]`);
		const playerOneCell = document.querySelector<HTMLElement>(`[data-stat-value="one-${category.id}"]`);
		const playerTwoCell = document.querySelector<HTMLElement>(`[data-stat-value="two-${category.id}"]`);
		const winnerCell = document.querySelector<HTMLElement>(`[data-stat-winner="${category.id}"]`);
		if (!row || !playerOneCell || !playerTwoCell || !winnerCell) {
			throw new Error(`The scoreboard is missing the ${category.id} row.`);
		}

		playerOneCell.textContent = category.playerOneDisplay;
		playerTwoCell.textContent = category.playerTwoDisplay;

		let winner: PlayerSide | 'tie';
		if (category.playerOneValue > category.playerTwoValue) {
			winner = 'one';
		} else if (category.playerTwoValue > category.playerOneValue) {
			winner = 'two';
		} else {
			winner = 'tie';
		}

		row.dataset.revealed = 'false';
		row.dataset.winner = winner;
		if (winner === 'one') {
			winnerCell.textContent = `${playerOne.username} (+1)`;
		} else if (winner === 'two') {
			winnerCell.textContent = `${playerTwo.username} (+1)`;
		} else {
			winnerCell.textContent = `Tie (+0.5 each)`;
		}
		categoryWinners.push({ id: category.id, winner });
	}

	for (const [index, category] of categoryWinners.entries()) {
		if (index > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			await delay(400);
		}
		const row = document.querySelector<HTMLTableRowElement>(`[data-stat-row="${category.id}"]`);
		if (!row) {
			throw new Error(`The scoreboard is missing the ${category.id} row.`);
		}
		row.dataset.revealed = 'true';
		playStatHit();

		if (category.winner === 'one') {
			playerOnePoints += 1;
		} else if (category.winner === 'two') {
			playerTwoPoints += 1;
		} else {
			playerOnePoints += 0.5;
			playerTwoPoints += 0.5;
		}

		playerOneScore.textContent = formatScore(playerOnePoints);
		playerTwoScore.textContent = formatScore(playerTwoPoints);
		hudScoreOne.textContent = formatScore(playerOnePoints);
		hudScoreTwo.textContent = formatScore(playerTwoPoints);
		updatePowerBar('one', playerOnePoints);
		updatePowerBar('two', playerTwoPoints);
	}

	if (playerOnePoints === playerTwoPoints) {
		winnerBanner.textContent = `DOUBLE K.O.! TIE GAME — ${formatScore(playerOnePoints)} POINTS EACH`;
		winnerBanner.dataset.result = 'tie';
	} else {
		const winner = playerOnePoints > playerTwoPoints ? playerOne : playerTwo;
		const winningScore = Math.max(playerOnePoints, playerTwoPoints);
		winnerBanner.textContent = `K.O.! VICTORY — ${winner.username} WINS (${formatScore(winningScore)} POINTS)`;
		winnerBanner.dataset.result = 'winner';
	}
	winnerBanner.classList.add('victory-animation');
	triggerCelebration();
	playVictoryFanfare();
}

function updatePowerBar(side: PlayerSide, points: number): void {
	const bar = document.querySelector<HTMLElement>(`#power-bar-${side}`);
	const fill = bar?.querySelector<HTMLElement>('.power-fill');
	if (!bar || !fill) {
		throw new Error(`The Player ${side === 'one' ? '1' : '2'} power bar is unavailable.`);
	}

	const boundedPoints = Math.max(0, Math.min(5, points));
	bar.setAttribute('aria-valuenow', String(boundedPoints));
	fill.style.width = `${(boundedPoints / 5) * 100}%`;
}

function triggerCelebration(): void {
	const particles = document.querySelector<HTMLElement>('#celebration-particles');
	if (!particles) {
		return;
	}

	particles.replaceChildren();
	const colors = ['#45f3ff', '#5fed83', '#ff3cac', '#ffd166', '#ffffff'];
	for (let index = 0; index < 32; index += 1) {
		const particle = document.createElement('span');
		const angle = (Math.PI * 2 * index) / 32;
		const distance = 90 + ((index * 37) % 170);
		particle.style.setProperty('--particle-x', `${Math.cos(angle) * distance}px`);
		particle.style.setProperty('--particle-y', `${Math.sin(angle) * distance}px`);
		particle.style.setProperty('--particle-color', colors[index % colors.length]);
		particle.style.animationDelay = `${(index % 6) * 20}ms`;
		particles.append(particle);
	}

	document.body.classList.remove('screen-shake');
	void document.body.offsetWidth;
	document.body.classList.add('screen-shake');
	window.setTimeout(() => {
		document.body.classList.remove('screen-shake');
		particles.replaceChildren();
	}, 1500);
}

function delay(milliseconds: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function formatPeakDay(day: ContributionDay | null): string {
	return day ? `${day.count.toLocaleString()} on ${formatDate(day.date)}` : 'No contributions';
}

function formatScore(score: number): string {
	return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function formatDate(value: string): string {
	const date = new Date(`${value}T00:00:00Z`);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function showError(message: string): void {
	if (!battleStatus) {
		return;
	}

	battleStatus.textContent = message;
	battleStatus.dataset.state = 'error';
}
