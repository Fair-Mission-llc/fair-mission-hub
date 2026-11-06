#!/usr/bin/env node
// Sprint 11 Revision 22.0: the release commit manifest (release-registry.ts RELEASE_COMMIT_LOG).
//
// Reads the newest commits from Git and writes packages/shared/src/fixtures/release-commits.json: hash, commit date
// (UTC, 'YYYY-MM-DD HH:MM:SS'), subject and the '- ' bullet lines of the body. When a Super Admin executes a release
// block, the server builds the change list from the commits dated after the previous release.
//
// build:pilot and build:exe run this first. Without Git (a copied source tree), the file on disk is kept as it is.
// The file is written only when its content changes.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KEEP = 40;
const BULLETS_PER_COMMIT = 12;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const RELEASE_LOG_PATH = join(root, 'packages', 'shared', 'src', 'fixtures', 'release-commits.json');

const utc = (iso) => new Date(iso).toISOString().slice(0, 19).replace('T', ' ');

/** Parses `git log` output written with the record and field separators below. */
export function parseGitLog(raw) {
  return raw
    .split('\x1e')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash, date, subject, body = ''] = record.split('\x1f');
      // A bullet starts with '- '; an indented line after it continues the same bullet.
      const all = [];
      for (const line of body.split(/\r?\n/)) {
        const t = line.trim();
        if (t.startsWith('- ')) all.push(t.slice(2).trim());
        else if (t && /^\s/.test(line) && all.length) all[all.length - 1] += ` ${t}`;
        else if (!t && all.length) all.push(null); // a blank line ends the bullet
      }
      const bullets = all.filter(Boolean).slice(0, BULLETS_PER_COMMIT);
      return { hash: hash.trim().slice(0, 7), date: utc(date.trim()), subject: subject.trim(), bullets };
    });
}

export function writeReleaseLog() {
  let raw;
  try {
    raw = execFileSync('git', ['log', `-${KEEP}`, '--format=%H%x1f%cI%x1f%s%x1f%b%x1e'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '[release-log] Git is not available: kept the existing release-commits.json.';
  }
  const text = `${JSON.stringify(parseGitLog(raw), null, 2)}\n`;
  if (existsSync(RELEASE_LOG_PATH) && readFileSync(RELEASE_LOG_PATH, 'utf8') === text) return '[release-log] release-commits.json is current.';
  writeFileSync(RELEASE_LOG_PATH, text, 'utf8');
  return `[release-log] wrote ${RELEASE_LOG_PATH}`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) console.log(writeReleaseLog());
