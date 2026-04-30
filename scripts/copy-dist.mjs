import { cp, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DIST_DIR = path.resolve("dist");
const deployPath = process.env.ASKAROLL_DEPLOY_PATH;

if (!deployPath) {
  console.error(
    "ASKAROLL_DEPLOY_PATH is not set. Add it to .env or provide it when running yarn copy:dist."
  );
  process.exitCode = 1;
  process.exit();
}

try {
  const distStats = await stat(DIST_DIR);

  if (!distStats.isDirectory()) {
    throw new Error(`${DIST_DIR} exists but is not a directory.`);
  }
} catch (error) {
  if (error?.code === "ENOENT") {
    console.error("dist/ does not exist. Run yarn build before yarn copy:dist.");
    process.exitCode = 1;
    process.exit();
  }

  throw error;
}

const destinationDir = path.resolve(deployPath);
const entries = await readdir(DIST_DIR);

await mkdir(destinationDir, { recursive: true });

await Promise.all(
  entries.map((entry) =>
    cp(path.join(DIST_DIR, entry), path.join(destinationDir, entry), {
      recursive: true,
      force: true,
    })
  )
);

console.log(`Copied dist/ contents to ${destinationDir}`);
