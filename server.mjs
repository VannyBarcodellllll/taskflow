import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const statuses = ['todo', 'doing', 'done'];
const priorities = ['low', 'medium', 'high'];
class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
function text(value, label, max, required = false) {
  if (typeof value !== 'string') throw new ApiError(400, `${label} must be text.`);
  const result = value.trim();
  if (result.length > max || (required && !result)) throw new ApiError(400, `${label} must be ${required ? '1' : '0'}–${max} characters.`);
  return result;
}
function date(value) {
  if (value === '' || value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(new Date(value).getTime()) || new Date(value).toISOString().slice(0, 10) !== value) throw new ApiError(400, 'Choose a valid due date.');
  return value;
}
async function body(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 64_000) throw new ApiError(413, 'Request too large.'); chunks.push(chunk); }
  try { const data = JSON.parse(Buffer.concat(chunks).toString()); if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error(); return data; }
  catch { throw new ApiError(400, 'Send a valid JSON object.'); }
}
export function createApp({ dbPath = join(root, 'data', 'taskflow.sqlite'), seed = true } = {}) {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS projects(id INTEGER PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#6d6af2', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','doing','done')), priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high')), due_date TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS tasks_project_status ON tasks(project_id,status);
    CREATE TABLE IF NOT EXISTS app_state(key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  if (seed && !db.prepare("SELECT value FROM app_state WHERE key='initialized'").get()) {
    if (db.prepare('SELECT count(*) AS count FROM projects').get().count > 0) {
      db.prepare("INSERT INTO app_state(key,value) VALUES('initialized','1')").run();
    } else {
    db.exec('BEGIN');
    try {
      const p = db.prepare('INSERT INTO projects(name,color) VALUES(?,?)');
      const portfolio = Number(p.run('Portfolio launch', '#6d6af2').lastInsertRowid);
      const learning = Number(p.run('Learning lab', '#18a58f').lastInsertRowid);
      const add = db.prepare('INSERT INTO tasks(project_id,title,description,status,priority) VALUES(?,?,?,?,?)');
      add.run(portfolio, 'Sketch the homepage', 'Try a few layouts and choose a visual direction.', 'todo', 'high');
      add.run(portfolio, 'Build the project gallery', 'Add your favorite work and a short explanation for each project.', 'doing', 'medium');
      add.run(portfolio, 'Write an introduction', 'Keep it brief and make it sound like you.', 'done', 'low');
      add.run(learning, 'Explore a REST API', 'Create a request, inspect the response, and connect it to the interface.', 'todo', 'medium');
      add.run(learning, 'Learn SQLite basics', 'Understand tables, relationships, and queries.', 'doing', 'high');
      db.prepare("INSERT INTO app_state(key,value) VALUES('initialized','1')").run();
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    }
  }
  const taskQuery = `SELECT tasks.*, projects.name AS project_name, projects.color AS project_color FROM tasks JOIN projects ON tasks.project_id=projects.id`;
  const getTask = id => db.prepare(taskQuery + ' WHERE tasks.id=?').get(id);
  const exists = (table, id) => { const item = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id); if (!item) throw new ApiError(404, 'Item not found.'); return item; };
  const json = (res, status, data) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); };
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/') && !['GET','HEAD'].includes(req.method) && req.headers.origin) {
        if (new URL(req.headers.origin).host !== req.headers.host) throw new ApiError(403, 'Cross-origin requests are not allowed.');
      }
      if (url.pathname === '/api/projects' && req.method === 'GET') return json(res, 200, db.prepare('SELECT projects.*,count(tasks.id) AS task_count FROM projects LEFT JOIN tasks ON tasks.project_id=projects.id GROUP BY projects.id ORDER BY projects.id').all());
      if (url.pathname === '/api/projects' && req.method === 'POST') {
        const data = await body(req), name = text(data.name, 'Project name', 80, true), color = data.color || '#6d6af2';
        if (!/^#[\da-f]{6}$/i.test(color)) throw new ApiError(400, 'Choose a valid color.');
        const id = Number(db.prepare('INSERT INTO projects(name,color) VALUES(?,?)').run(name, color).lastInsertRowid);
        return json(res, 201, exists('projects', id));
      }
      const projectMatch = url.pathname.match(/^\/api\/projects\/(\d+)$/);
      if (projectMatch && req.method === 'DELETE') { exists('projects', projectMatch[1]); db.prepare('DELETE FROM projects WHERE id=?').run(projectMatch[1]); return json(res, 200, {ok:true}); }
      if (url.pathname === '/api/tasks' && req.method === 'GET') return json(res, 200, db.prepare(taskQuery + ' ORDER BY tasks.id DESC').all());
      const taskMatch = url.pathname.match(/^\/api\/tasks\/(\d+)$/);
      if (taskMatch && req.method === 'DELETE') { exists('tasks', taskMatch[1]); db.prepare('DELETE FROM tasks WHERE id=?').run(taskMatch[1]); return json(res, 200, {ok:true}); }
      if ((url.pathname === '/api/tasks' && req.method === 'POST') || (taskMatch && req.method === 'PATCH')) {
        const old = taskMatch ? exists('tasks', taskMatch[1]) : { description:'', status:'todo', priority:'medium', due_date:null };
        const data = {...old, ...await body(req)};
        const title = text(data.title, 'Task title', 160, true), description = text(data.description, 'Description', 4000);
        if (!Number.isSafeInteger(data.project_id) || data.project_id < 1) throw new ApiError(400, 'Choose a project.');
        exists('projects', data.project_id);
        if (!statuses.includes(data.status) || !priorities.includes(data.priority)) throw new ApiError(400, 'Choose a valid status and priority.');
        const due = date(data.due_date);
        let id;
        if (taskMatch) { id = Number(taskMatch[1]); db.prepare('UPDATE tasks SET project_id=?,title=?,description=?,status=?,priority=?,due_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(data.project_id,title,description,data.status,data.priority,due,id); }
        else id = Number(db.prepare('INSERT INTO tasks(project_id,title,description,status,priority,due_date) VALUES(?,?,?,?,?,?)').run(data.project_id,title,description,data.status,data.priority,due).lastInsertRowid);
        return json(res, taskMatch ? 200 : 201, getTask(id));
      }
      if (url.pathname.startsWith('/api/')) throw new ApiError(404, 'API route not found.');
      const assets = {'/':['index.html','text/html'], '/index.html':['index.html','text/html'], '/app.js':['app.js','text/javascript'], '/style.css':['style.css','text/css'], '/favicon.svg':['favicon.svg','image/svg+xml']};
      const asset = assets[url.pathname];
      if (!asset || !['GET','HEAD'].includes(req.method)) throw new ApiError(404, 'Page not found.');
      res.writeHead(200, {'Content-Type':asset[1]+'; charset=utf-8'}); res.end(req.method === 'HEAD' ? undefined : readFileSync(join(root,'public',asset[0])));
    } catch (error) { json(res, error.status || 500, {error:error.status ? error.message : 'Something went wrong. Please try again.'}); }
  });
  server.on('close', () => db.close());
  return server;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = createApp({ dbPath: process.env.TASKFLOW_DB || undefined });
  const port = Number(process.env.PORT || 4175);
  server.listen(port, '127.0.0.1', () => console.log(`Taskflow: http://127.0.0.1:${port}`));
}
