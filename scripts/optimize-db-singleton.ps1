# PowerShell script to add singleton pattern to database.ts
$file = "C:\Users\jayno\Projects\bookieball\src\db\database.ts"
$content = Get-Content $file -Raw

# Replace the openDatabase function to use a singleton
$oldFunc = @'
export function openDatabase(): Database.Database {
  ensureDatabaseFile();
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const hasTeamsTable = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'teams' LIMIT 1")
    .get() as { 1: number } | undefined;
  if (hasTeamsTable) {
    ensureSeasonFiveExpansionTeams(db);
  }
  clearLegacySeasonFiveMasterCarryover(db);
  return db;
}
'@

$newFunc = @'
/**
 * Singleton instance holder. A single persistent connection is the standard
 * pattern for better-sqlite3, avoiding the overhead of open/close per request.
 */
let _openDatabaseSingleton: Database.Database | null = null;

/**
 * Force-resets the singleton (used during init / testing when a fresh
 * connection is needed after file replacement).
 */
export function resetDatabaseSingleton(): void {
  if (_openDatabaseSingleton) {
    try { _openDatabaseSingleton.close(); } catch {}
    _openDatabaseSingleton = null;
  }
}

export function openDatabase(): Database.Database {
  if (_openDatabaseSingleton) {
    return _openDatabaseSingleton;
  }
  ensureDatabaseFile();
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const hasTeamsTable = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'teams' LIMIT 1")
    .get() as { 1: number } | undefined;
  if (hasTeamsTable) {
    ensureSeasonFiveExpansionTeams(db);
  }
  clearLegacySeasonFiveMasterCarryover(db);
  _openDatabaseSingleton = db;
  return db;
}
'@

if ($content -match [regex]::Escape($oldFunc)) {
    $content = $content -replace [regex]::Escape($oldFunc), $newFunc
    Set-Content $file -Value $content -NoNewline
    Write-Host "Successfully updated openDatabase to use singleton pattern."
} else {
    Write-Host "ERROR: Could not find the openDatabase function in the file."
    Write-Host "Checking file length: $($content.Length) chars"
}
