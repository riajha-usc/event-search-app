# Event Search App

This repository contains a full-stack Event Search application built with Angular (frontend) and Node.js/Express (backend). It proxies Ticketmaster API requests on the backend (so the API key is not exposed), uses ipinfo and Google Geocoding on the frontend, and stores favorites in MongoDB Atlas.

Quick summary of what is already implemented:

- Backend (`/backend/server.js`) provides endpoints:

  - `GET /api/suggest?keyword=...` - Ticketmaster suggest
  - `GET /api/events/search?...` - Ticketmaster events search (size=20)
  - `GET /api/events/:id` - Ticketmaster event details
  - `GET /api/spotify/artist?name=...` - Spotify artist search (requires Spotify creds)
  - `GET /api/spotify/artist/:id/albums` - Spotify artist albums
  - `GET /api/favorites` - list favorites
  - `POST /api/favorites` - add favorite
  - `DELETE /api/favorites/:eventId` - remove favorite

- Frontend (`/frontend`) is an Angular app that:
  - Calls `ipinfo.io` and Google Geocoding directly from browser
  - Calls backend `/api` endpoints for Ticketmaster & Spotify
  - Implements search, event details, and favorites pages

## Environment

1. Backend environment file

   - Copy `/backend/.env.example` to `/backend/.env` and fill values:
     - `TICKETMASTER_API_KEY` (required)
     - `MONGODB_URI` (optional but recommended for favorites persistence)
     - `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` (optional)
     - `PORT` (optional, default 8080)

2. Frontend environment
   - Provide IPInfo token and Google Maps key in `frontend/src/environments/environment.ts` or set them during deployment. Example keys in `environment.template.ts`.

## Local development (recommended)

1. Start the backend

```bash
# from repository root
cd backend
# install deps if not already
npm install
# copy env file and edit
cp .env.example .env
# fill .env with your keys
npm run dev
```

2. Start the frontend (separate terminal)

```bash
cd frontend
npm install
# serve with proxy so /api is proxied to backend
npm start
```

This uses `frontend/proxy.conf.json` which proxies `/api` to `http://localhost:8080`.

## Production build and serve static

To serve the built Angular app from the Node backend (for deployment):

```bash
# build the frontend
cd frontend
npm run build

# copy the production output into backend/dist/frontend/browser
# (adjust paths if necessary - Angular's output is usually in dist/<project-name>)
mkdir -p ../backend/dist/frontend/browser
cp -R dist/frontend/* ../backend/dist/frontend/browser/

# start backend
cd ../backend
npm start
```

## Notes and next steps

- The project already includes backend and frontend logic for the assignment requirements. I created `/backend/.env.example` and this README to help run it locally.
- Next I can:
  - Add CI-friendly scripts, automated tests for key endpoints, and small validation checks.
  - Help you deploy to Google Cloud Run or App Engine and set production environment variables.

If you'd like, I can now:

- Run the app locally and perform a sample search to verify end-to-end functionality, or
- Add the README details into a deploy script for Cloud Run, or
- Implement any missing UI polish or specific behaviors you want improved.

Tell me which of the above you'd like me to do next.
