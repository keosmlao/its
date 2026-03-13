import express from 'express';
import cors from 'cors';
import { CORS_ORIGIN, DEBUG } from './config.js';

import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import ticketsRouter from './routes/tickets.js';
import projectsRouter from './routes/projects.js';
import tasksRouter from './routes/tasks.js';
import assetsRouter from './routes/assets.js';
import usersRouter from './routes/users.js';
import categoriesRouter from './routes/categories.js';
import slaRouter from './routes/sla.js';
import knowledgeRouter from './routes/knowledge.js';
import notificationsRouter from './routes/notifications.js';
import departmentsRouter from './routes/departments.js';
import divisionsRouter from './routes/divisions.js';
import requestersRouter from './routes/requesters.js';
import supportUsersRouter from './routes/supportUsers.js';
import assignmentsRouter from './routes/assignments.js';
import uploadsRouter from './routes/uploads.js';

const app = express();

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/users', usersRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/sla', slaRouter);
app.use('/api/knowledge', knowledgeRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/divisions', divisionsRouter);
app.use('/api/requesters', requestersRouter);
app.use('/api/support-users', supportUsersRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/uploads', uploadsRouter);

const port = parseInt(process.env.PORT || '5001', 10);
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  console.log(`Server running on http://${host}:${port}`);
});
