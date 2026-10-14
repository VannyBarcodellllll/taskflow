# Taskflow

A full-stack task management application built with Node.js, SQLite, and JavaScript. Features include a responsive dashboard, project organization, a Kanban board, a list view, task editing, priorities, due dates, search, filters, and drag-and-drop status updates.

## The full stack

- **Frontend:** semantic HTML, responsive CSS, and browser JavaScript.
- **Backend:** a Node.js HTTP server with a JSON REST API and input validation.
- **Database:** SQLite through Node's built-in `node:sqlite`, with foreign keys and an index. Data survives server restarts.

The database lives in `data/taskflow.sqlite` and is ignored by Git. Keep that file if you want to preserve your tasks. This is a personal app running on your own computer; it has no sign-in system. Add authentication and a production hosting setup before making it a shared internet service. GitHub Pages can host static pages, so it cannot run this backend.

## Test

```sh
npm test
```

The integration test uses a temporary database. It checks validation, updates, persistence after reopening the server, related-task deletion, and cross-origin write protection.

Optional environment variables: `PORT` changes the default port; `TASKFLOW_DB` chooses a database path. The server binds to the local computer's loopback address.
