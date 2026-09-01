#!/usr/bin/env node

/**
 * Sync versions between package.json, Cargo.toml, and tauri.conf.json
 * so Changesets (which only bumps package.json) keep the Tauri crate in lockstep.
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const rootDir = process.cwd();

const packageJson = JSON.parse(
  readFileSync(join(rootDir, "package.json"), "utf8"),
);
const version = packageJson.version;

console.log(`Syncing version to ${version}`);

const cargoTomlPath = join(rootDir, "src-tauri", "Cargo.toml");
let cargoToml = readFileSync(cargoTomlPath, "utf8");
cargoToml = cargoToml.replace(/^version = "[^"]*"/m, `version = "${version}"`);
writeFileSync(cargoTomlPath, cargoToml);
console.log("Updated src-tauri/Cargo.toml");

const tauriConfPath = join(rootDir, "src-tauri", "tauri.conf.json");
const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf8"));
tauriConf.version = version;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n");
console.log("Updated src-tauri/tauri.conf.json");

console.log("Version sync complete");
