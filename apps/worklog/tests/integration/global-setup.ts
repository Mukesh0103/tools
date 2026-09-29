import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";
import { runMigrations } from "@/lib/db/migrate";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/**
 * One Postgres for the whole integration run. Starts a Testcontainer by
 * default. Set TEST_DATABASE_URL, for example to a Neon branch, to use an
 * existing database instead.
 */
export default async function setup(project: TestProject) {
  let container: StartedPostgreSqlContainer | undefined;
  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    container = await new PostgreSqlContainer("postgres:17-alpine").start();
    url = container.getConnectionUri();
  }
  await runMigrations(url);
  project.provide("databaseUrl", url);
  return async () => {
    await container?.stop();
  };
}
