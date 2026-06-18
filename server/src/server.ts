import express, { Request, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';

const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/database.sqlite');
const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS heroes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    special_skill TEXT NOT NULL,
		attack INTEGER,
		defence INTEGER
  )
`);

app.get('/', (req: Request, res: Response) => {
  const users = db.prepare('SELECT * FROM heroes').all()
  res.json(users);
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});