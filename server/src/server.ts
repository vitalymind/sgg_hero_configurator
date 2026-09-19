import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import { ALLOWED_CORS_DOMAIN } from './constants.js';
import { dbInitEmpty } from './database.js';
import { createAuthRouter } from './routes/auth.js';
import { createHeroesRouter } from './routes/heroes.js';

// Init
const app = express();

app.use(cors({
	origin: ALLOWED_CORS_DOMAIN,
	credentials: true
}));

app.use(express.json());
app.use(cookieParser());

const port = process.env.PORT || 3000;
const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/database.sqlite');
const db = new DatabaseSync(dbPath);

// Init DB if does not exist
dbInitEmpty(db);

// Routes
app.use('/api', createAuthRouter(db));
app.use('/api/heroes', createHeroesRouter(db));

// Start listening
app.listen(port, () => {
	console.log(`Server is running at http://localhost:${port}`);
});