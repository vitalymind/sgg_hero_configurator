import { DatabaseSync } from "node:sqlite";
import { Hero } from "@hero_manager/shared";
import crypto from 'crypto';

//Generate short (for better UI), but still strongly unique, given low burst frequency
export function generateShortHeroId(): string {
	const timePart = Date.now().toString(36);
	const randomPart = crypto.randomBytes(4).toString('hex');
	const rawId = timePart + randomPart;
	return rawId.match(/.{1,4}/g)?.join('-') || rawId;
}

// DB Operations
export function getTimeStamp(): number {
	return Date.now()
}

export function dbInitEmpty(db: DatabaseSync): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS heroes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			uuid TEXT UNIQUE NOT NULL,
			name TEXT NOT NULL,
			special_skill_id TEXT NOT NULL,
			attack INTEGER,
			defense INTEGER,
			status TEXT NOT NULL DEFAULT 'active',
			last_updated INTEGER NOT NULL
		)
	`);

	db.exec(`
		CREATE TABLE IF NOT EXISTS sessions (
			token TEXT PRIMARY KEY,
			email TEXT NOT NULL,
			expiresAt INTEGER NOT NULL
		)
	`);

	db.exec(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT UNIQUE NOT NULL,
			name TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			last_login INTEGER
		)
	`);

	db.exec(`
		CREATE TABLE IF NOT EXISTS otps (
			email TEXT PRIMARY KEY,
			otp TEXT NOT NULL,
			name TEXT,
			expires_at INTEGER NOT NULL,
			attempts INTEGER NOT NULL DEFAULT 0
		)
	`);

	//Debug
	const countRow = db.prepare('SELECT COUNT(id) as count FROM heroes').get() as { count: number };
	if (countRow.count === 0) {
		debugSeedDatabase(db);
		console.log("Database was empty: Seeded with 35 debug heroes.");
	}
}

export function dbGetHeroesSince(db: DatabaseSync, timestamp: number): Hero[] {
	const stmt = db.prepare(`
		SELECT id, uuid, name, special_skill_id, attack, defense, status 
		FROM heroes 
		WHERE last_updated > ?
	`);
	return stmt.all(timestamp) as unknown as Hero[];
}

export function dbGetActiveUuids(db: DatabaseSync): string[] {
	const stmt = db.prepare(`SELECT uuid FROM heroes WHERE status = 'active'`);
	const rows = stmt.all() as { uuid: string }[];
	return rows.map(r => r.uuid);
}

export function dbCreateHero(db: DatabaseSync, uuid: string, name: string, attack: number, defense: number, specialSkillId: string): Hero | undefined {
	const stmt = db.prepare(`
		INSERT INTO heroes (uuid, name, attack, defense, special_skill_id, last_updated, status) 
		VALUES (?, ?, ?, ?, ?, ?, 'active')
		RETURNING id, uuid, name, special_skill_id, attack, defense, status
	`);
	return stmt.get(uuid, name, attack, defense, specialSkillId, getTimeStamp()) as Hero | undefined;
}

export function dbUpdateHero(db: DatabaseSync, uuid: string, name: string, attack: number, defense: number, specialSkillId: string, status: string): Hero | undefined {
	const stmt = db.prepare(`
		UPDATE heroes
		SET name = ?, attack = ?, defense = ?, special_skill_id = ?, status = ?, last_updated = ?
		WHERE uuid = ?
		RETURNING id, uuid, name, special_skill_id, attack, defense, status
	`);
	return stmt.get(name, attack, defense, specialSkillId, status, getTimeStamp(), uuid) as Hero | undefined;
}

export function dbGetSession(db: DatabaseSync, token: string): { email: string, expiresAt: number } | undefined {
	const stmt = db.prepare('SELECT email, expiresAt FROM sessions WHERE token = ?');
	return stmt.get(token) as { email: string, expiresAt: number } | undefined;
}

export function dbCreateOrUpdateSession(db: DatabaseSync, token: string, email: string, expiresAt: number): void {
	const stmt = db.prepare(`
		INSERT INTO sessions (token, email, expiresAt)
		VALUES (?, ?, ?)
		ON CONFLICT(token) DO UPDATE SET expiresAt = excluded.expiresAt
	`);
	stmt.run(token, email, expiresAt);
}

export function dbDeleteSession(db: DatabaseSync, token: string): void {
	const stmt = db.prepare('DELETE FROM sessions WHERE token = ?');
	stmt.run(token);
}

// User Operations
export interface DbUser {
	id: number;
	email: string;
	name: string;
	created_at: number;
	last_login: number | null;
}

export function dbGetUserByEmail(db: DatabaseSync, email: string): DbUser | undefined {
	const stmt = db.prepare('SELECT id, email, name, created_at, last_login FROM users WHERE email = ?');
	return stmt.get(email) as unknown as DbUser | undefined;
}

export function dbCreateOrUpdateUser(db: DatabaseSync, email: string, name: string): DbUser {
	const now = getTimeStamp();
	const stmt = db.prepare(`
		INSERT INTO users (email, name, created_at, last_login)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(email) DO UPDATE SET 
			name = CASE WHEN excluded.name != '' THEN excluded.name ELSE users.name END,
			last_login = excluded.last_login
		RETURNING id, email, name, created_at, last_login
	`);
	return stmt.get(email, name, now, now) as unknown as DbUser;
}

// OTP Operations
export interface DbOtp {
	email: string;
	otp: string;
	name: string | null;
	expires_at: number;
	attempts: number;
}

export function dbSaveOtp(db: DatabaseSync, email: string, otp: string, name: string | undefined, expiresAt: number): void {
	const stmt = db.prepare(`
		INSERT INTO otps (email, otp, name, expires_at, attempts)
		VALUES (?, ?, ?, ?, 0)
		ON CONFLICT(email) DO UPDATE SET
			otp = excluded.otp,
			name = COALESCE(excluded.name, otps.name),
			expires_at = excluded.expires_at,
			attempts = 0
	`);
	stmt.run(email, otp, name ?? null, expiresAt);
}

export function dbGetOtp(db: DatabaseSync, email: string): DbOtp | undefined {
	const stmt = db.prepare('SELECT email, otp, name, expires_at, attempts FROM otps WHERE email = ?');
	return stmt.get(email) as unknown as DbOtp | undefined;
}

export function dbIncrementOtpAttempts(db: DatabaseSync, email: string): number {
	const stmt = db.prepare(`
		UPDATE otps
		SET attempts = attempts + 1
		WHERE email = ?
		RETURNING attempts
	`);
	const res = stmt.get(email) as { attempts: number } | undefined;
	return res?.attempts ?? 0;
}

export function dbDeleteOtp(db: DatabaseSync, email: string): void {
	const stmt = db.prepare('DELETE FROM otps WHERE email = ?');
	stmt.run(email);
}

//Debug
function debugSeedDatabase(db: DatabaseSync): void {
	const initialHeroes = [
		{ name: "Lianna", attack: 95, defense: 75, special_skill_id: "perfect_shot" },
		{ name: "Richard", attack: 75, defense: 95, special_skill_id: "frost_strike" },
		{ name: "Vivica", attack: 65, defense: 90, special_skill_id: "healing_light" },
		{ name: "Elena", attack: 90, defense: 70, special_skill_id: "blade_storm" },
		{ name: "Sartana", attack: 85, defense: 80, special_skill_id: "death_strike" },
		{ name: "Gravemaker", attack: 85, defense: 85, special_skill_id: "burn" },
		{ name: "Telluria", attack: 60, defense: 98, special_skill_id: "force_of_forest" },
		{ name: "Vela", attack: 85, defense: 75, special_skill_id: "water_damage" },
		{ name: "Joon", attack: 95, defense: 60, special_skill_id: "solar_beam" },
		{ name: "Magni", attack: 92, defense: 65, special_skill_id: "sniper_strike" },
		{ name: "Marjana", attack: 85, defense: 75, special_skill_id: "magma_blast" },
		{ name: "Isarnia", attack: 88, defense: 68, special_skill_id: "glacial_shatter" },
		{ name: "Kadilen", attack: 75, defense: 85, special_skill_id: "shield_of_nature" },
		{ name: "Elkanen", attack: 78, defense: 82, special_skill_id: "life_drain" },
		{ name: "Azlar", attack: 90, defense: 60, special_skill_id: "volcano_eruption" },
		{ name: "Quintus", attack: 85, defense: 65, special_skill_id: "lightning_strike" },
		{ name: "Domitia", attack: 80, defense: 80, special_skill_id: "shadow_strike" },
		{ name: "Leonidas", attack: 82, defense: 78, special_skill_id: "holy_light" },
		{ name: "Obakan", attack: 85, defense: 70, special_skill_id: "counter_attack" },
		{ name: "Horghall", attack: 65, defense: 95, special_skill_id: "tree_smash" },
		{ name: "Thorne", attack: 70, defense: 90, special_skill_id: "ice_cleave" },
		{ name: "Justice", attack: 65, defense: 95, special_skill_id: "blinding_light" },
		{ name: "Khagan", attack: 75, defense: 85, special_skill_id: "khan_command" },
		{ name: "Heimdall", attack: 65, defense: 98, special_skill_id: "horn_of_giallar" },
		{ name: "Alfrike", attack: 85, defense: 88, special_skill_id: "mindless_attack" },
		{ name: "Bera", attack: 75, defense: 85, special_skill_id: "moth_swarm" },
		{ name: "Freya", attack: 70, defense: 90, special_skill_id: "raven_flock" },
		{ name: "Frigg", attack: 85, defense: 80, special_skill_id: "nature_defense_down" },
		{ name: "Odin", attack: 88, defense: 75, special_skill_id: "holy_damage" },
		{ name: "Finley", attack: 92, defense: 70, special_skill_id: "chain_strike" },
		{ name: "Killhare", attack: 95, defense: 65, special_skill_id: "reckless_swing" },
		{ name: "Jabberwock", attack: 88, defense: 75, special_skill_id: "double_strike" },
		{ name: "Seshat", attack: 85, defense: 75, special_skill_id: "replicating_minion" },
		{ name: "Black Knight", attack: 60, defense: 99, special_skill_id: "taunt" },
		{ name: "Krampus", attack: 65, defense: 95, special_skill_id: "frost_taunt" }
	];
	for (const hero of initialHeroes) {
		const heroUuid = generateShortHeroId();
		dbCreateHero(db, heroUuid, hero.name, hero.attack, hero.defense, hero.special_skill_id);
	}
}