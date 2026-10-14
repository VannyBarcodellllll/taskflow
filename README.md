# Taskflow

A full-stack task management application built with Node.js, SQLite, and JavaScript. Features include a responsive dashboard, project organization, a Kanban board, a list view, task editing, priorities, due dates, search, filters, and drag-and-drop status updates.

## Run it

Install Node.js 24 or later. Open a terminal in this folder and run:

```sh
npm start
```

Visit **http://127.0.0.1:4175**. No package installation or external account is required. The first launch creates a few example tasks; you can edit or remove them.

## The full stack

- **Frontend:** semantic HTML, responsive CSS, and browser JavaScript.
- **Backend:** a Node.js HTTP server with a JSON REST API and input validation.
- **Database:** SQLite through Node's built-in `node:sqlite`, with foreign keys and an index. Data survives server restarts.

The database lives in `data/taskflow.sqlite` and is ignored by Git. Keep that file if you want to preserve your tasks. This is a personal app running on your own computer; it has no sign-in system. Add authentication and a production hosting setup before making it a shared internet service. GitHub Pages can host static pages, so it cannot run this backend.

## Files

```text
server.mjs          HTTP server, API, validation, database schema
public/index.html   Accessible interface and forms
public/style.css    Dashboard design and responsive layouts
public/app.js       API calls, rendering, filtering, board interactions
test/api.test.mjs   API and database integration test
```

## API

| Method | Route | Behavior |
| --- | --- | --- |
| GET | /api/projects | List projects and task counts |
| POST | /api/projects | Create a project with name and color |
| DELETE | /api/projects/:id | Delete a project and its tasks |
| GET | /api/tasks | List tasks with their project details |
| POST | /api/tasks | Create a task |
| PATCH | /api/tasks/:id | Update any task fields |
| DELETE | /api/tasks/:id | Delete a task |

Task fields: `project_id`, `title`, `description`, `status` (`todo`, `doing`, `done`), `priority` (`low`, `medium`, `high`), and optional `due_date` (`YYYY-MM-DD`).

## Test

```sh
npm test
```

The integration test uses a temporary database. It checks validation, updates, persistence after reopening the server, related-task deletion, and cross-origin write protection.

Optional environment variables: `PORT` changes the default port; `TASKFLOW_DB` chooses a database path. The server binds to the local computer's loopback address.

## Ideas for the next version

Planned improvements include user accounts, team assignments, comments, activity history, and a production deployment configuration.
