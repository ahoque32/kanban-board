import { ensureDbInitialized } from "../src/lib/init";

async function main() {
  await ensureDbInitialized();
  console.log("Database initialized.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
