import fs from "node:fs";

const rootPackage = JSON.parse(fs.readFileSync("package.json", "utf8"));
const tauriConfig = JSON.parse(fs.readFileSync("src-tauri/tauri.conf.json", "utf8"));
const cargoToml = fs.readFileSync("src-tauri/Cargo.toml", "utf8");

const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const versions = {
	"package.json": rootPackage.version,
	"src-tauri/Cargo.toml": cargoVersion,
	"src-tauri/tauri.conf.json": tauriConfig.version,
};

const missing = Object.entries(versions)
	.filter(([, version]) => !version)
	.map(([file]) => file);

if (missing.length > 0) {
	console.error(`Missing version in: ${missing.join(", ")}`);
	process.exit(1);
}

const unique = new Set(Object.values(versions));
if (unique.size !== 1) {
	console.error("Version mismatch:");
	for (const [file, version] of Object.entries(versions)) {
		console.error(`- ${file}: ${version}`);
	}
	process.exit(1);
}

const packageManager = rootPackage.packageManager;
if (packageManager !== "pnpm@10.33.0") {
	console.error(`Expected packageManager pnpm@10.33.0, got ${packageManager ?? "<missing>"}`);
	process.exit(1);
}

console.log(`Release metadata OK: v${rootPackage.version}, ${packageManager}`);
