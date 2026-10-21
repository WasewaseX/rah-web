// Narrow ambient types for bun:sqlite - the runtime's built-in SQLite reader
// used by the .apkg import. bun-types is installed as a package (not under
// node_modules/@types), so tsc does not auto-include it; a global reference
// could conflict with @types/node, so we declare exactly the surface we use.
declare module "bun:sqlite" {
  export class Database {
    constructor(path: string, opts?: { readonly?: boolean });
    query(sql: string): { all: () => unknown[]; get: () => unknown; run: (...args: unknown[]) => void };
    run(sql: string): void;
    close(): void;
  }
}
