import Database from 'better-sqlite3';
import { openDatabase } from './database.js';

/**
 * Singleton database instance for better-sqlite3.
 * Opening/closing connections per request is expensive; a single persistent
 * connection is the standard pattern for better-sqlite3 since it is synchronous.
 */
let _dbInstance: Database.Database | null = null;

/**
 * Returns the shared database instance, creating it on first call.
 */
export function getDb(): Database.Database {
  if (!_dbInstance) {
    _dbInstance = openDatabase();
  }
  return _dbInstance;
}

/**
 * Closes the singleton database instance (used during shutdown).
 */
export function closeDb(): void {
  if (_dbInstance) {
    try {
      _dbInstance.close();
    } catch {
      // ignore close errors during shutdown
    }
    _dbInstance = null;
  }
}
