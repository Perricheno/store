import postgres from "postgres";

// Dedicated CI database: parallel test files must not share accounts, seeds or migrations.
if (!process.env.CORE_TEST_DATABASE_URL)
  throw new Error("CORE_TEST_DATABASE_URL is required");
const sql = postgres(process.env.CORE_TEST_DATABASE_URL, { max: 1 });
try {
  const existing =
    await sql`SELECT 1 FROM pg_database WHERE datname='urbanmag_wallet_test'`;
  if (!existing.length)
    await sql.unsafe("CREATE DATABASE urbanmag_wallet_test");
} finally {
  await sql.end();
}
