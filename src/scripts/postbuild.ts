import { mkdirSync, cpSync, existsSync } from "fs";
import { resolve } from "path";

const srcPath = resolve("src/routes/oauth/public");
const destPath = resolve("dist/routes/oauth/public");

try {
  if (!existsSync(srcPath)) {
    console.warn(`Source folder not found: ${srcPath}`);
    process.exit(0);
  }
  mkdirSync(destPath, { recursive: true });
  cpSync(srcPath, destPath, { recursive: true });
} catch (error) {
  console.error("Error copying OAuth public files:", error);
  process.exit(1);
}
