import type { APIRoute } from 'astro';

export const prerender = false;

const GITHUB_USERNAME_PATTERN = /^(?!-)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38}[a-zA-Z0-9])?$/;

export function isValidGitHubUsername(value: string | undefined): boolean {
	if (!value) {
		return false;
	}

	const normalized = value.trim();
	return normalized.length > 0 && normalized.length <= 39 && GITHUB_USERNAME_PATTERN.test(normalized);
}

function toIsoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function flattenContributionDays(weeks: Array<{ first_day?: string; contribution_days?: Array<{ weekday?: number; count?: number; level?: number }> }> = []) {
	return weeks.flatMap((week) => {
		if (!week.first_day) {
			return [];
		}

		const weekStart = new Date(`${week.first_day}T00:00:00Z`);
		return (week.contribution_days ?? []).map((day) => {
			const date = new Date(weekStart);
			date.setUTCDate(date.getUTCDate() + (day.weekday ?? 0));
			return {
				date: toIsoDate(date),
				weekday: day.weekday ?? 0,
				count: Number(day.count ?? 0),
				level: Number(day.level ?? 0),
			};
		});
	});
}

export const GET: APIRoute = async ({ params }) => {
	const username = params.username ?? '';

	if (!isValidGitHubUsername(username)) {
		return new Response(
			JSON.stringify({
				error: 'Invalid GitHub username',
				username,
			}),
			{
				status: 400,
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					'Cache-Control': 'public, max-age=300',
				},
			},
		);
	}

	const upstreamUrl = `https://github.com/${encodeURIComponent(username)}.contribs`;

	try {
		const response = await fetch(upstreamUrl, {
			headers: {
				Accept: 'application/json',
				'User-Agent': 'Mozilla/5.0 (compatible; MonaMayhem/1.0)',
			},
		});

		if (response.status === 404) {
			return new Response(
				JSON.stringify({
					error: 'GitHub user not found',
					username,
				}),
				{
					status: 404,
					headers: {
						'Content-Type': 'application/json; charset=utf-8',
						'Cache-Control': 'public, max-age=300',
					},
				},
			);
		}

		if (!response.ok) {
			return new Response(
				JSON.stringify({
					error: 'Failed to fetch contribution data from GitHub',
					username,
					status: response.status,
				}),
				{
					status: 502,
					headers: {
						'Content-Type': 'application/json; charset=utf-8',
						'Cache-Control': 'public, max-age=300',
					},
				},
			);
		}

		const data = (await response.json()) as {
			generated_at?: string;
			from?: string;
			to?: string;
			range_days?: number;
			total_contributions?: number;
			private_contributions_included?: boolean;
			colors_full?: string[];
			weeks?: Array<{
				index?: number;
				first_day?: string;
				contribution_days?: Array<{
					weekday?: number;
					count?: number;
					level?: number;
				}>;
			}>;
		};

		if (!data || !Array.isArray(data.weeks)) {
			return new Response(
				JSON.stringify({
					error: 'Malformed contribution payload from GitHub',
					username,
				}),
				{
					status: 500,
					headers: {
						'Content-Type': 'application/json; charset=utf-8',
						'Cache-Control': 'public, max-age=300',
					},
				},
			);
		}

		const daily = flattenContributionDays(data.weeks);
		const payload = {
			username,
			generatedAt: data.generated_at,
			from: data.from,
			to: data.to,
			rangeDays: Number(data.range_days ?? daily.length),
			totalContributions: Number(data.total_contributions ?? daily.reduce((sum, day) => sum + Number(day.count ?? 0), 0)),
			privateContributionsIncluded: Boolean(data.private_contributions_included),
			colors: data.colors_full ?? [],
			calendar: data.weeks,
			daily,
		};

		return new Response(JSON.stringify(payload), {
			status: 200,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Cache-Control': 'public, max-age=300',
			},
		});
	} catch (error) {
		console.error('GitHub contribution fetch failed', error);
		return new Response(
			JSON.stringify({
				error: 'Upstream GitHub contribution request failed',
				username,
			}),
			{
				status: 502,
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					'Cache-Control': 'public, max-age=300',
				},
			},
		);
	}
};
