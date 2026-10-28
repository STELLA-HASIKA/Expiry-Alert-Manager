# Expiry Alert Manager

A beginner-friendly full-stack web application for tracking products across categories, checking expiry dates, and reducing avoidable waste. Built with plain HTML, CSS and JavaScript, an Express API, and Supabase PostgreSQL.

## 1. Features

- Add, view, edit and delete products (real CRUD through the backend and Supabase).
- Categories: Food, Medicine, Personal Care, Household and Other.
- Expiry status labels: expired, expiring soon (within 7 days), and not urgent.
- Search by product name or notes; filter by category and status.
- Dashboard summary cards, responsive layout, loading and empty states, success/error feedback, form validation and delete confirmation.
- Backend validation, UUID checks, useful HTTP errors, parameterized Supabase queries, CORS allowlist and JSON body-size limit.
- SQL constraints, indexes, timestamps, update trigger and Row Level Security policies.

## 2. Technology stack

- Frontend: HTML5, CSS3, vanilla JavaScript and Fetch API.
- Backend: Node.js, Express.js, CORS, dotenv, Supabase JavaScript client and `ws`.
- Database: Supabase PostgreSQL.
- Version control: Git and GitHub.

## 3. Prerequisites

Install:
- Node.js 18.18 or newer (Node.js 20 LTS or newer is recommended).
- npm (included with Node.js).
- A free Supabase account/project.
- A browser and a code editor.
- Optional: Git and a local static server such as VS Code Live Server.

## 4. Set up Supabase

1. Create a project at [Supabase](https://supabase.com/). Keep the project password private.
2. Open the project dashboard and select **SQL Editor**.
3. Open `database/schema.sql` from this repository, copy the entire script, paste it into SQL Editor and run it.
4. In **Project Settings → API** (the label may vary), copy the Project URL and the publishable key (or legacy anon key). Do not copy the `service_role` / secret key.
5. The SQL creates `public.products`, constraints, indexes, an `updated_at` trigger and RLS policies. The policies are deliberately permissive for a classroom single-user demo. See the security note below.

## 5. Configure the backend

Open a terminal in the project folder, then enter the backend directory:

```bash
cd backend
```

Copy `.env.example` to `.env` (on Windows PowerShell, run `Copy-Item .env.example .env`; on macOS/Linux, run `cp .env.example .env`) and edit `.env`:

```dotenv
PORT=3000
FRONTEND_ORIGIN=http://localhost:5500
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_LEGACY_ANON_KEY
```

Replace the placeholders with your project's actual URL and publishable/anon key. Do not add quotes unless needed, and never commit `.env`.

### Install dependencies (run all commands inside `backend/`)

The `package.json` already declares all runtime and development dependencies, so **`npm install` alone is sufficient**. The following extra commands are included for clarity only and are not required after a successful `npm install`:

```bash
npm install
npm install express cors dotenv @supabase/supabase-js ws
npm install --save-dev nodemon
```

## 6. Start the app

### Terminal 1 — backend

From the `backend/` directory:

```bash
npm run dev
```

Or use `npm start` for the normal start script. The API should log that it is listening at `http://localhost:3000`.

### Terminal 2 — frontend

Serve the `frontend/` directory through a local static server. For example, in VS Code, install/use **Live Server**, right-click `frontend/index.html`, and choose **Open with Live Server**. It commonly serves the page at `http://localhost:5500`. This origin matches the default CORS configuration.

Alternatively, if Python is installed, run this from the project root:

```bash
python -m http.server 5500 --directory frontend
```

Then open `http://localhost:5500`. Do not open `index.html` directly using a `file://` URL; use a local server.

If your frontend server uses a different origin, update `FRONTEND_ORIGIN` in `backend/.env` to that exact origin (multiple origins can be comma-separated), then restart the backend.

## 7. API endpoints

Base URL: `http://localhost:3000/api`

| Method | Endpoint | Purpose | Success response |
|---|---|---|---|
| GET | `/health` | API health and config status | `200` JSON |
| GET | `/products` | List products ordered by expiry date | `200 { "products": [...] }` |
| GET | `/products/:id` | Read one product | `200 { "product": {...} }` |
| POST | `/products` | Create a product | `201 { "product": {...} }` |
| PATCH | `/products/:id` | Update provided fields | `200 { "product": {...} }` |
| DELETE | `/products/:id` | Delete a product | `200 { "message": "...", "id": "..." }` |

Example create request:

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Oat milk","category":"Food","quantity":2,"expiry_date":"2027-01-15","notes":"Top shelf"}'
```

Use a future `expiry_date` for the example or substitute a valid date. To list records, open `http://localhost:3000/api/products` in a browser. For PATCH and DELETE, replace `PRODUCT_UUID` with an ID returned by the API.

## 8. Testing instructions

From `backend/`, run:

```bash
npm run check
```

This performs Node.js syntax checks on the backend files. It does not verify a live Supabase connection.

With the backend running:
- Open `http://localhost:3000/api/health`; `supabaseConfigured` should be `true`.
- Open `http://localhost:3000/api/products`; with the SQL schema installed and correct credentials, it should return `{ "products": [] }` for a new table.
- Add a product through the website, refresh the page and confirm it remains.
- Edit the product, test search and filters, then delete it.
- Try a blank name, invalid quantity, or missing category; the form/API should reject invalid input.
- Try an unknown UUID on a single-product route; the API should return `404` if the UUID is well-formed and the record is missing.

No live Supabase credentials are shipped with this project. A live database connection and end-to-end CRUD test must be performed after you configure your own project.

## 9. Git and GitHub submission

From the project root:

```bash
git init
git add .
git status
git commit -m "Build Expiry Alert Manager"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/expiry-alert-manager.git
git push -u origin main
```

Create an empty repository on GitHub first and replace the URL with your own. Before committing, verify that `backend/.env` is not staged. `.gitignore` excludes environment files and dependencies.

## 10. Troubleshooting

- **`SUPABASE_CONFIG_MISSING` / configuration message:** Confirm `backend/.env` exists, variable names are exact and values are filled in; restart the backend after editing.
- **Table missing / `PGRST205`:** Run `database/schema.sql` in Supabase SQL Editor and verify the table is named `products`.
- **Access denied / `42501`:** Check that the SQL policies and grants were applied. Do not fix this by disabling RLS.
- **CORS error:** Make `FRONTEND_ORIGIN` match the browser origin exactly (including scheme and port), then restart Node.
- **`Failed to fetch`:** Ensure the backend is running at port 3000 and the frontend is served over HTTP, not `file://`.
- **Port already in use:** Set a different `PORT` in `.env` and update `API_BASE` in `frontend/script.js` if you change port 3000.
- **Invalid date:** Enter a real calendar date using the date picker.
- **Network/database error:** Check the terminal running Node for the detailed Supabase error and confirm internet connectivity.

## 11. Known limitations and security notes

- This is a **single-user classroom demo**, not a production-ready private inventory service. The RLS policies allow unauthenticated `anon` clients to read and modify all rows in this demo table. Anyone who obtains the public project URL/key can potentially access the data. RLS is enabled, but these demo policies are intentionally permissive. Do not store sensitive data.
- For real multi-user use, add Supabase Auth, an `owner_id` column referencing `auth.users`, enforce ownership in RLS policies, and authenticate API requests. Alternatively, use a properly protected server-side service-role key only on the backend with strict authorization. Never expose a service-role/secret key in browser code.
- There is no account system, email/push notification, barcode scanning, multi-user access control, or deployment configuration. The current expiry labels are computed in the browser based on the user's local calendar date; they are reminders, not proof of product safety.
- The backend uses the public anon/publishable key rather than a privileged secret key. Database permissions are intentionally set up for the demo policies in `schema.sql`.

## 12. Project demonstration script

1. Introduce Expiry Alert Manager as a simple tool to track product expiry dates and reduce waste.
2. Show the summary cards and explain that the numbers come from database records.
3. Add a Food product with quantity and expiry date; show the success message and new card.
4. Add a product expiring in the next few days and point out its “Expiring soon” label.
5. Search for a product and filter by category/status.
6. Edit its quantity or expiry date and show the update.
7. Delete a test product and confirm the record is removed.
8. Briefly show the Express endpoints and the Supabase `products` table.

## 13. Beginner-friendly viva questions

**Q1. What is the purpose of this project?**  
A: It stores product details and expiry dates so users can identify expired or soon-to-expire items and reduce avoidable waste.

**Q2. What is the role of Express.js?**  
A: Express runs the backend server, defines REST API routes, validates requests and sends JSON responses to the frontend.

**Q3. Why use Supabase?**  
A: Supabase provides a hosted PostgreSQL database and an API client, allowing product records to be stored persistently online.

**Q4. What is CRUD?**  
A: CRUD stands for Create, Read, Update and Delete—the four basic operations performed on product records.

**Q5. Why is Row Level Security (RLS) important?**  
A: RLS applies database policies to decide which rows a database role can access. RLS is enabled in this project, but the demo policies are permissive; real private data needs authenticated, owner-specific policies.

---
Made as a beginner-friendly full-stack college project. Configure Supabase before expecting persistent product operations to work.
