# CIRCLOSET — Wear More. Buy Less.

Hyperlocal clothing-sharing and rental prototype (Chennai pilot).

## Run locally
Requires Node.js 16+ (no `npm install` needed).

    cd circloset
    npm start

Open http://localhost:3000

Or simply double-click `public/index.html` — it also works without a server.

## Demo logins
- Renter + lender: priya@circloset.in / demo123
- Admin: admin@circloset.in / admin123

## Files
- public/index.html  – page shell
- public/styles.css  – theme and responsive layout
- public/app.js      – app logic, demo data, matching engine, booking, dashboards
- server.js          – tiny static server

## Notes
Data is saved in your browser (localStorage). Payments, auth and location are mocked.
Reset anytime from Profile -> Reset demo data.

## v2 features
- **Login / Register**: name, phone, address, area, proof of identity (type, number, photo) with validation; **Continue with Google** (prototype chooser — for production add Google Identity Services with your OAuth client ID inside `gGo()` in `features.js`). New accounts start as "ID under review"; admin opens *Admin → Users → View ID → Verify*.
- **Dashboard** (post-login home): animated counters, flow tracker, upcoming pickups, activity chart. Animations on page change, scroll, click (ripple), progress bar, confetti; respects reduced-motion.
- **Rent & Sell**: each listing is Rent only, Sell only or both; buy checkout, orders under Bookings; "Rent / Buy" filter in Explore; list form has "Offer as" + selling price.
- **Pickup navigation**: map + one-tap Google Maps directions + distance from your location, shown after booking/purchase. Pin coordinates are approximate area centres (`AREAS` in `app.js`) — replace with exact pickup coordinates.
- Files added: `public/features.js`. Demo login accounts stored in localStorage (`circloset_acc`, plaintext — prototype only).

## v3 — backend (Express + MongoDB)
```
cp .env.example .env      # set JWT_SECRET (and GOOGLE_CLIENT_ID for real Google login)
npm install
npm run seed              # demo data; logins below, password Circloset@123
npm start                 # http://localhost:3000   (needs MongoDB running)
```
Demo logins: admin@circloset.com · user@circloset.com · seller@circloset.com (all `Circloset@123`).
`npm run start:static` runs the original zero-dependency server (localStorage demo, no MongoDB).

**API**: `/api/auth/{register,login,google,me,logout}`, `/api/users/{profile,identity}`, `/api/clothing`, `/api/rentals`, `/api/orders`, `/api/reviews`, `/api/notifications`, `/api/dashboard{,/listings,/impact}`, `/api/admin/{stats,users}`.
- Passwords: bcrypt. Sessions: JWT in an httpOnly cookie. ID documents live in `uploads/identity` (never served statically); only the owner or an admin can fetch `/api/users/:id/identity`.
- Rent / Sale / Rent & Sell via `listingType`. Rentals reject overlapping dates on the server; purchases use an atomic update so only one buyer can win.
- Exact pickup coordinates are stripped from public listings and returned only to the renter/buyer/owner after a confirmed transaction (`pickup` in the response) for `navigateToPickup(lat,lng)`.
- Google login verifies a Google ID token server-side (`POST /api/auth/google {credential}`); returns 501 until `GOOGLE_CLIENT_ID` is set.
- Payments are mocked in `services/payment.js` (10% commission, `COMMISSION_PCT`); plug Razorpay/Stripe in there.

**Status:** the backend is complete but the browser UI (`app.js`/`features.js`) still runs on its localStorage demo data. `public/api.js` is ready for wiring each screen to the API.

## Spring Boot backend
The `backend/` directory contains the Java migration foundation using Spring Web, Security, Data JPA/Hibernate, PostgreSQL via Supabase, Redis, STOMP WebSocket, and REST APIs. See [backend/README.md](backend/README.md) for local setup. The existing Node backend remains available while routes and authentication are migrated.

## Deploy to Vercel
1. Push this repository to GitHub and import it in Vercel, or run `npx vercel` from the project directory.
2. Set these Vercel environment variables: `MONGODB_URI` and a random `JWT_SECRET` with at least 16 characters. Add `GOOGLE_CLIENT_ID` if Google sign-in is enabled.
3. Use a MongoDB provider reachable from Vercel, such as MongoDB Atlas. Run `npm run seed` locally against the same `MONGODB_URI` if demo data is needed.

The Vercel function writes uploaded files to temporary storage. For production, replace the local Multer storage with durable object storage such as Vercel Blob or S3; files in `/tmp` can disappear between invocations.
