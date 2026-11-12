#!/usr/bin/env node
// Validation locale de la bibliothèque pol-teams : mêmes règles que Pol
// (cf. FORMAT.md et superbot/apps/api/src/library/). Sans dépendance :
//   node scripts/validate.mjs
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NEWLINE = String.fromCharCode(10);

const errors = [];
const warnings = [];
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

// ---- Règles (miroir de Pol).
const LIMITS = {
  catalogBytes: 256_000,
  manifestBytes: 256_000,
  skillBytes: 64_000,
  maxTeams: 100,
  maxMembers: 12,
  maxSkillsPerMember: 8,
  maxInstructions: 2_000,
  maxSkillName: 80,
};
const COLORS = [
  "green", "blue", "red", "orange", "purple", "cyan",
  "pink", "yellow", "teal", "coral", "silver", "chrome",
];
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const KEY = /^[a-z0-9][a-z0-9_-]*$/;
const SEGMENT = /^[A-Za-z0-9._-]+$/;

const IGNORED_FIELDS = new Set([
  "room", "rooms", "bulletin", "defaultresponder", "responder",
  "routine", "routines", "schedule", "schedules", "cron", "trigger", "triggers",
  "connection", "connections", "connector", "connectors", "composio", "cloud",
  "account", "accounts", "token", "tokens", "secret", "secrets", "apikey",
  "apikeys", "credentials", "env",
  "tool", "tools", "toolset", "toolsets", "mcp", "mcpservers", "allowedtools",
  "computer", "browser", "shell", "command", "commands", "workflows",
  "approval", "approvals", "approvalmode", "alwaysallow", "allowkey",
  "allowsession", "autoapprove", "autonomous", "standingrule", "standingrules", "yolo",
]);

const APPROVAL_PHRASES = [
  "ignore previous", "ignore les instructions", "ignorez les instructions",
  "nouvelles instructions", "ignore above", "approve", "auto-approve",
  "auto approve", "approuve", "approuver", "always allow", "toujours autoriser",
  "without asking", "sans demander", "sans confirmation", "do not ask",
  "don't ask", "ne demande pas", "full access", "accès complet",
  "droits élevés", "yolo", "bypass", "contourner", "contourne",
  "skip approval", "saute l'approbation",
];

const BASE64_BLOB = new RegExp("[A-Za-z0-9+/]{200,}={0,2}");
const SHELL_FETCHERS = ["curl", "wget", "iwr", "invoke-webrequest"];
const SHELLS = ["sh", "bash", "zsh", "dash", "ksh"];

function isInvisible(code) {
  return (
    code <= 0x08 || code === 0x0b || code === 0x0c || (code >= 0x0e && code <= 0x1f) ||
    code === 0x7f || code === 0xad || code === 0x061c ||
    (code >= 0x200b && code <= 0x200f) || (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2060 && code <= 0x2064) || (code >= 0x2066 && code <= 0x2069) ||
    code === 0xfeff || (code >= 0xe0000 && code <= 0xe007f)
  );
}

function checkText(value, field) {
  for (const char of String(value)) {
    if (isInvisible(char.codePointAt(0) ?? 0)) {
      fail(`${field} : caractère invisible ou bidi (Unicode)`);
      return;
    }
  }
}

function checkContent(value, field) {
  const lower = String(value).toLowerCase();
  if (BASE64_BLOB.test(value)) warn(`${field} : blob base64 long (possible charge cachée)`);
  for (const line of lower.split(NEWLINE)) {
    if (!SHELL_FETCHERS.some((word) => line.includes(word))) continue;
    for (const part of line.split("|").slice(1)) {
      const words = part.trim().split(" ").filter(Boolean);
      const target = words[0] === "sudo" ? (words[1] ?? "") : (words[0] ?? "");
      if (SHELLS.includes(target)) warn(`${field} : commande pipée vers un shell (curl | sh)`);
    }
  }
  for (const phrase of APPROVAL_PHRASES) {
    if (lower.includes(phrase)) warn(`${field} : formule visant les approbations « ${phrase} »`);
  }
}

function checkIgnored(value, field) {
  const walk = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, item] of Object.entries(node)) {
        if (IGNORED_FIELDS.has(key.toLowerCase())) {
          warn(`${path}.${key} : champ ignoré par Pol (règle 2), signalé en aperçu`);
        }
        walk(item, `${path}.${key}`);
      }
    }
  };
  walk(value, field);
}

function safePath(value, field, prefix, suffix) {
  const path = String(value);
  const segments = path.split("/");
  const ok =
    path.length <= 300 &&
    !path.startsWith("/") &&
    segments.every((part) => part !== "" && part !== "." && part !== ".." && SEGMENT.test(part)) &&
    path.startsWith(prefix) &&
    path.endsWith(suffix);
  if (!ok) fail(`${field} : chemin refusé (attendu sous ${prefix}, sans « .. »)`);
  return ok;
}

function readText(rel, maxBytes) {
  const path = join(ROOT, rel);
  if (!existsSync(path)) {
    fail(`${rel} : fichier manquant`);
    return null;
  }
  const raw = readFileSync(path, "utf8");
  if (Buffer.byteLength(raw, "utf8") > maxBytes) {
    fail(`${rel} : trop volumineux (${maxBytes} octets maximum)`);
    return null;
  }
  return raw;
}

function readJson(rel, maxBytes) {
  const raw = readText(rel, maxBytes);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    fail(`${rel} : JSON invalide`);
    return null;
  }
}

function checkSkill(rel) {
  const raw = readText(rel, LIMITS.skillBytes);
  if (raw === null) return;
  checkText(raw, rel);
  checkContent(raw, rel);
  if (!raw.startsWith(`---${NEWLINE}`)) {
    fail(`${rel} : SKILL.md sans front matter`);
    return;
  }
  const end = raw.indexOf(`${NEWLINE}---`, 4);
  if (end === -1) {
    fail(`${rel} : front matter non fermée`);
    return;
  }
  const fields = new Map();
  for (const line of raw.slice(4, end).split(NEWLINE)) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):[ ]*(.*)$/);
    if (match) fields.set(match[1], match[2].trim().replace(/^["']|["']$/g, ""));
  }
  const name = fields.get("name") ?? "";
  const description = fields.get("description") ?? "";
  if (!name || name.length > LIMITS.maxSkillName || !description) {
    fail(`${rel} : front matter sans name (≤ 80) / description valides`);
  }
}

// ---- Catalogue.
const catalog = readJson("catalog.json", LIMITS.catalogBytes);
if (catalog) {
  checkIgnored(catalog, "catalog.json");
  if (catalog.format !== "pol.catalog" || catalog.version !== 1) {
    fail("catalog.json : format « pol.catalog » version 1 attendu");
  }
  const teams = Array.isArray(catalog.teams) ? catalog.teams : [];
  if (teams.length > LIMITS.maxTeams) fail("catalog.json : trop d'équipes (100 maximum)");
  const slugs = new Set();
  for (const [index, entry] of teams.entries()) {
    const field = `catalog.json teams[${index}]`;
    const slug = String(entry?.slug ?? "");
    if (!SLUG.test(slug) || slug.length > 80) fail(`${field}.slug : invalide`);
    if (slugs.has(slug)) fail(`${field}.slug : dupliqué`);
    slugs.add(slug);
    for (const key of ["name", "summary", "category"]) {
      if (typeof entry?.[key] !== "string" || !entry[key].trim()) fail(`${field}.${key} : requis`);
      else checkText(entry[key], `${field}.${key}`);
    }
    if (typeof entry?.members !== "number" || entry.members < 1 || entry.members > LIMITS.maxMembers) {
      fail(`${field}.members : entier 1-12 attendu`);
    }
    const prefix = `teams/${slug}/`;
    if (safePath(entry?.manifest, `${field}.manifest`, prefix, ".json")) {
      checkTeam(entry.manifest, slug, entry);
    }
    safePath(entry?.readme, `${field}.readme`, prefix, "README.md");
    const skills = Array.isArray(entry?.skills) ? entry.skills : [];
    if (skills.length > 32) fail(`${field}.skills : 32 chemins maximum`);
    for (const [skillIndex, path] of skills.entries()) {
      safePath(path, `${field}.skills[${skillIndex}]`, `${prefix}skills/`, "SKILL.md");
    }
  }
}

// ---- Manifeste d'équipe.
function checkTeam(rel, slug, entry) {
  const manifest = readJson(rel, LIMITS.manifestBytes);
  if (!manifest) return;
  checkIgnored(manifest, rel);
  if (manifest.format !== "openmaus.team" || ![1, 2].includes(manifest.version)) {
    fail(`${rel} : format « openmaus.team » version 1 ou 2 attendu`);
  }
  const team = manifest.team ?? {};
  if (typeof team.name !== "string" || !team.name.trim() || team.name.length > 100) {
    fail(`${rel} : team.name requis (≤ 100)`);
  } else checkText(team.name, `${rel} team.name`);
  if (team.description !== undefined) {
    if (String(team.description).length > 2_000) fail(`${rel} : team.description trop longue (2 000)`);
    checkText(team.description, `${rel} team.description`);
  }
  const members = Array.isArray(team.members) ? team.members : [];
  if (members.length < 1 || members.length > LIMITS.maxMembers) {
    fail(`${rel} : 1 à 12 membres attendus`);
  }
  if (entry && members.length !== entry.members) {
    warn(`${rel} : ${members.length} membres, le catalogue annonce ${entry.members}`);
  }
  const seenKeys = new Set();
  for (const [index, member] of members.entries()) {
    const field = `${rel} members[${index}]`;
    const key = String(member?.key ?? "");
    if (!KEY.test(key) || key.length > 64) fail(`${field}.key : invalide`);
    if (seenKeys.has(key)) fail(`${field}.key : dupliqué (${key})`);
    seenKeys.add(key);
    const name = String(member?.name ?? "");
    if (!name.trim() || name.length > 100) fail(`${field}.name : requis (≤ 100)`);
    else checkText(name, `${field}.name`);
    if (member?.title !== undefined && String(member.title).length > 200) {
      fail(`${field}.title : trop longue (200)`);
    }
    const description = String(member?.description ?? "");
    if (description.length > 4_000) fail(`${field}.description : trop longue (4 000)`);
    checkText(description, `${field}.description`);
    checkContent(description, `${field}.description`);
    const soul = String(member?.soul ?? "");
    if (Buffer.byteLength(soul, "utf8") > 24_000) fail(`${field}.soul : trop longue (24 000 octets)`);
    checkText(soul, `${field}.soul`);
    checkContent(soul, `${field}.soul`);
    // Règle Pol : description + soul deviennent les instructions du bot.
    const instructions = [description.trim(), soul.trim()].filter(Boolean).join(NEWLINE + NEWLINE);
    if (instructions.length > LIMITS.maxInstructions) {
      fail(`${field} : instructions (description + soul) au-delà de ${LIMITS.maxInstructions} caractères`);
    }
    const color = member?.appearance?.color;
    if (!COLORS.includes(color)) fail(`${field}.appearance.color : couleur non prise en charge`);
    const skills = Array.isArray(member?.skills) ? member.skills : [];
    if (skills.length > LIMITS.maxSkillsPerMember) fail(`${field}.skills : 8 maximum par membre`);
    for (const skillName of skills) {
      if (!KEY.test(String(skillName))) {
        fail(`${field}.skills : nom invalide (${String(skillName)})`);
        continue;
      }
      const skillRel = `teams/${slug}/skills/${skillName}/SKILL.md`;
      if (safePath(skillRel, `${field}.skills`, `teams/${slug}/skills/`, "SKILL.md")) {
        checkSkill(skillRel);
      }
    }
  }
}

// ---- Bilan.
for (const message of warnings) console.warn(`AVERTISSEMENT ${message}`);
for (const message of errors) console.error(`REFUS ${message}`);
if (errors.length > 0) {
  console.error(`pol-teams : ${errors.length} refus, ${warnings.length} avertissement(s).`);
  process.exit(1);
}
console.log(`pol-teams : bibliothèque valide, ${warnings.length} avertissement(s).`);
