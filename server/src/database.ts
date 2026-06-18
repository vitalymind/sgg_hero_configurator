import { DatabaseSync } from "node:sqlite";
import { Hero } from "./interfaces.js";

// Data sanitization
export function sanitizeString(input: any, allowedChars: string[]): string | null {
	if (typeof input !== 'string') {return null};
	const allowedSet = new Set(allowedChars);
	for (const char of input) {
		if (!allowedSet.has(char)) {return null}
	}
	return input;
}

export function parseNumber(input: any): number | null {
	if (typeof input === 'number') {
		return Math.floor(input)
	} else if (typeof input === 'string') {
		const parsed = parseInt(input, 10);
		if (!isNaN(parsed)) {return parsed}
	}
	return null;
}

// DB Operations
export function getTimeStamp(): number {
	return Date.now()
}

export function dbInitEmpty(db: DatabaseSync): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS heroes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			special_skill_id TEXT NOT NULL,
			attack INTEGER,
			defense INTEGER,
			status TEXT NOT NULL DEFAULT 'active',
			last_updated INTEGER NOT NULL
		)
	`);
}

export function dbGetHeroesSince(db: DatabaseSync, timestamp: number): Hero[] {
	const stmt = db.prepare('SELECT id, name, special_skill_id, attack, defense, status FROM heroes WHERE last_updated > ?');
	return stmt.all(timestamp) as unknown as Hero[];
}

export function dbCreateHero(db: DatabaseSync, name: string, attack: number, defense: number, specialSkillId: string): Hero | undefined {
	const stmt = db.prepare(`
		INSERT INTO heroes (name, attack, defense, special_skill_id, last_updated, status) 
		VALUES (?, ?, ?, ?, ?, 'active')
		RETURNING id, name, special_skill_id, attack, defense, status
	`);
	return stmt.get(name, attack, defense, specialSkillId, getTimeStamp()) as Hero | undefined;
}

export function dbUpdateHero(db: DatabaseSync, id: number, name: string, attack: number, defense: number, specialSkillId: string, status: string): Hero | undefined {
	const stmt = db.prepare(`
		UPDATE heroes
		SET name = ?, attack = ?, defense = ?, special_skill_id = ?, status = ?, last_updated = ?
		WHERE id = ?
		RETURNING id, name, special_skill_id, attack, defense, status
	`);
	return stmt.get(name, attack, defense, specialSkillId, status, getTimeStamp(), id) as Hero | undefined;
}