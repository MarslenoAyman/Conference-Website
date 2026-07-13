# هو انهى؟

A conference hub for a boys' Christian retreat (3 days, 2 nights): instructions, daily
timeline, spiritual topics, games, and team standings — with three access levels and a
bonus-points system for buying gifts at the end.

## Access levels

- **Full access** (servant, admin) — edit everything: instructions, timeline, topics,
  games, teams; assign members to teams; give team points and individual bonus points.
- **Limited access** (servant) — view all teams and their points; add/edit/delete
  instructions only.
- **No access** (served) — view-only; sees only their own team and its points.

Full and limited accounts are pre-loaded (see below). Served members create their own
account on the Sign up page with just their name and phone number — their password is
always their phone number. New sign-ups start on no team ("Unassigned") until a
full-access servant assigns them to one from the Teams page.

## Running it locally

Requires [Node.js](https://nodejs.org) 18+.

```
npm run install:all
npm run dev
```

This opens the site at **http://localhost:5173**. The API runs on port 4000.

You don't need to install Postgres to develop locally — if no `DATABASE_URL` is set,
the app automatically starts a small embedded database on your machine (data is saved
in `server/data/local-dev-db`, ignored by git). The very first run seeds it with the
accounts, instructions, timeline, topics, games, and teams listed below.

## Pre-loaded accounts

Password = phone number, for all accounts.

**Full access:** Amir Ashraf, Kiro Ehab, Tobia, Fr Philopater Girgis, Hany Moris, Magdy,
Marsleno Ayman, Philopater Ghobrial.

**Limited access:** Ehab Heneen, Emil Adle, George Fathy, Marcos Adel, Soliman Hefzy,
Andrew Amir, Andrew Samir, Gazo, Hady Demian, Malk Milad, Ramy Oncy, Ayman Labib.

To change who has full/limited access, edit the lists in
`server/src/db/migrate.js` — but note this seed only runs once, the very first time the
database is empty. To re-seed, you'd need to clear the `users` table (or the whole
database) first.

## Getting a public link (free)

To make the site reachable from anyone's phone, you need two free accounts (I can't
create these for you — this only takes a few minutes):

### 1. A free Postgres database (so nothing is ever lost)

1. Go to [neon.tech](https://neon.tech) and sign up (free, no card required).
2. Create a new project. Copy the **connection string** it gives you (starts with
   `postgres://...`).

### 2. Free app hosting

1. Push this project to a GitHub repository.
2. Go to [render.com](https://render.com) and sign up (free, no card required).
3. Click **New → Blueprint**, connect your GitHub repo — it will read the included
   `render.yaml` automatically.
4. When it asks for the `DATABASE_URL` environment variable, paste the Neon connection
   string from step 1.
5. Deploy. Render gives you a public `https://your-app.onrender.com` link — that's the
   one to share.

Render's free tier can go to sleep after periods of inactivity and takes ~30–60 seconds
to wake back up on the next visit — but because the data lives in Neon's Postgres
(not on Render's disk), nothing is ever lost when that happens.

## Project structure

```
client/   React app (Vite)
server/   Express API + Postgres access
```
