declare module 'better-sqlite3' {
  class Database {
    constructor(filename: string);
    prepare(sql: string): any;
    exec(sql: string): void;
    pragma(statement: string): unknown;
    transaction<T extends (...args: any[]) => any>(fn: T): T;
    close(): void;
  }

  namespace Database {
    type Database = any;
  }

  export = Database;
}
