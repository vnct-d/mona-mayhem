# Mona Mayhem Architecture

## Overview

The project is built as an Astro application with a small set of page routes and server endpoints. It is structured to let the main battle experience live in a few focused sections while keeping the codebase easy to extend.

## Stack

- Astro for routing and page rendering
- TypeScript or JavaScript for application logic
- Tailwind CSS where styling consistency is needed, otherwise scoped CSS blocks
- Small, modular UI components and route-level logic

## Suggested structure

- `src/pages/` routes for pages and endpoints
- `src/components/` reusable UI pieces for battle cards, score panels, and display widgets
- `src/lib/` or utility modules for formatting or data transformation logic, if needed
- `src/pages/api/` server routes for data access and GitHub contribution fetching

## Routing and app flow

1. A page loads the battle UI and presents a challenge or comparison view.
2. The app requests contribution data through an Astro API route.
3. Data is normalized and displayed in a visually styled, retro arcade layout.
4. Components remain small and focused so the experience is easy to extend and maintain.

## Design constraints

- Prefer modular components over large monolithic page files.
- Follow existing naming conventions and file organization patterns.
- Keep data-fetching logic separate from display concerns where practical.
- Favor readable code and plain-language implementation over clever abstractions.
- Keep the app aligned with the project goal: a playful GitHub contribution battle arena called Mona Mayhem.
