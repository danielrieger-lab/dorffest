# Laubhaufen

Laubhaufen is a collaborative offline-first PWA for shared recipes, weekly meal planning, and a synced shopping list.

## Stack

- Vite + React + TypeScript
- PWA support via `vite-plugin-pwa`
- Firebase Auth + Firestore for anonymous multi-user collaboration
- GitHub Pages deployment workflow

## What It Does

- Store and edit shared recipes with ingredients and instructions
- Plan meals for the week by day and meal slot
- Track a shared shopping list with check-off state
- Sync changes across users through Firestore without a visible login screen

## Local setup

1. Install dependencies.
2. Create a `.env.local` file if you want sync enabled.
3. Run the dev server.

```bash
npm install
npm run dev
```

## Firebase config

Create these Vite env vars for free-tier Firebase sync:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

If they are missing, the app still works locally and stores data in the browser.

The app uses these Firestore root collections:

- `recipes`
- `weeklyMeals`
- `shoppingItems`

Anonymous auth is enabled in the app so Firestore can stay protected while keeping the UI login-free.

## GitHub Pages

The Vite base path is set to `/Laubhaufen/` for GitHub Pages hosting. If your repo name is different, update `vite.config.ts`.

The workflow in `.github/workflows/deploy.yml` builds the app and publishes the `dist` folder to GitHub Pages.
