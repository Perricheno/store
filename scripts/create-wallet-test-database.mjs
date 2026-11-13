import postgres from "postgres";

// Dedicated CI databases: parallel test files must not share accounts, seeds or migrations.
if (!process.env.CORE_TEST_DATABASE_URL)
  throw new Error("CORE_TEST_DATABASE_URL is required");
const sql = postgres(process.env.CORE_TEST_DATABASE_URL, { max: 1 });
try {
  for (const name of ["urbanmag_wallet_test", "urbanmag_cart_test"]) {
    const existing = await sql`SELECT 1 FROM pg_database WHERE datname=${name}`;
    if (!existing.length) await sql.unsafe(`CREATE DATABASE ${name}`);
  }
} finally {
  await sql.end();
}
