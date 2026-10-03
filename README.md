# Publishly — Blog Content Management System

Publishly is a multi-user full-stack blog publishing platform. People can create an account, sign in, and publish their thoughts through a responsive React dashboard.

## Technology

- Frontend: React, Vite, CSS
- Backend: Node.js built-in HTTP server
- Storage: JSON file (`Backend/data/posts.json`), created automatically

## Features

- Register and sign in with an individual account
- Create posts with title, category, and content under the signed-in author's name
- View newest posts first
- Search posts and filter them by category
- Users can edit and delete only their own posts
- Persistent local data and responsive interface

## Run locally

Open two terminals.

```bash
cd Backend
npm start
```

```bash
cd Frontend/content-management
npm run dev
```

Open the URL Vite prints (normally `http://localhost:5173`).

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/posts` | List all posts |
| POST | `/api/posts` | Create a post |
| PUT | `/api/posts/:id` | Update a post |
| DELETE | `/api/posts/:id` | Delete a post |
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out |

## Deployment

1. Create a GitHub repository and push this entire project.
2. Deploy `Backend` as a Render Web Service. Build command: `npm install`; start command: `npm start`.
3. Deploy `Frontend/content-management` on Vercel. Set `VITE_API_URL` to `https://YOUR-RENDER-URL/api` and redeploy.

## Project report

### Objective
Build a web-based application that lets users manage blog content through an interactive interface.

### Implementation summary
The React frontend collects post details and communicates with a REST API. The Node.js backend validates input and stores the posts in a JSON file. The application follows CRUD operations: Create, Read, Update, and Delete.

### Testing
Test the application by publishing a new post, searching it, changing its details, refreshing the page to verify persistence, and deleting it. The project build can be checked with `npm run build` in the frontend folder.

### Future improvements
Authentication, a database such as MongoDB/PostgreSQL, image uploads, rich text editing, and user roles can be added for production use.
