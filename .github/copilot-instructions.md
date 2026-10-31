# Copilot Instructions for Mona Mayhem

## Project overview

Mona Mayhem is a retro arcade GitHub contribution battle arena built with Astro. The app compares GitHub contribution activity between users and presents it as a playful leaderboard or battle experience. The goal is to make contribution data feel engaging, readable, and fun without sacrificing code clarity.

## Tech stack

- Astro
- TypeScript / JavaScript
- Tailwind CSS when available, otherwise scoped CSS modules/styles
- Modern front-end conventions that keep pages and components small, focused, and easy to understand

## Goals

- Build a polished retro arcade experience for a GitHub contribution comparison app
- Use GitHub contribution data to create a competitive, visual “battle arena” feel
- Keep the experience fast, accessible, and easy to reason about
- Favor readable implementation over clever abstractions

## Project rules

- Keep components small, modular, and reusable.
- Follow the existing naming conventions in the repo.
- Prefer clear, explicit code over clever or overly abstract patterns.
- Keep files organized by feature or route rather than mixing unrelated concerns.
- Use simple, maintainable logic and avoid unnecessary indirection.
- Write code that is easy for another developer to understand at a glance.
- When styling, prefer Tailwind utilities for consistency when used in the project; otherwise use scoped component CSS with clear class names.
- Keep UI patterns consistent with the retro arcade aesthetic.
- Ensure API routes, data fetching, and UI logic remain easy to test and maintain.

## Repo expectations

- Preserve Astro project conventions and file structure.
- Use routes and server endpoints in the existing Astro patterns.
- Keep page and component names aligned with the rest of the codebase.
- Prefer incremental, readable changes over large refactors.

## Build and validation

- Use the project scripts for local development and builds.
- Validate changes with the smallest relevant check before concluding work.
- Do not add unnecessary dependencies or over-engineer the solution.

## Response style for AI assistance

- Suggest straightforward implementations.
- Break complex work into small, understandable steps.
- Prefer maintainable code quality over optimization for optimization's sake.
- Keep the app aligned with the “Mona Mayhem” retro arcade theme and GitHub contribution battle concept.
