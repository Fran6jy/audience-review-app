import fs from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { chromium } from 'playwright-core';
import { getInstagramNames } from '../src/lib/data.js';
import { parseProfileMetadata, validateApproval, nextJournal, recoverInterrupted, assertExecutionApproved } from '../src/lib/companion.js';
import { findFollowerRow } from './instagram-ui.mjs';

const args = process.argv.slice(2);
const command = args[0];
const option = key => { const at = args.indexOf(`--${key}`); return at >= 0 ? args[at + 1] : null; };
const has = key => args.includes(`--${key}`);
const root = process.cwd();
const localDir = path.join(root, 'private-instagram-import');
const profileDir = path.join(root, '.local-instagram-browser');
const owner = option('owner');
const executablePath = option('chrome') || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const stamp = () => new Date().toISOString();

async function writeJsonAtomic(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value, null, 2));
  await fs.rename(temporary, file);
}

async function followersFrom(file) {
  const data = JSON.parse(await fs.readFile(file, 'utf8'));
  return getInstagramNames(data, 'followers');
}

async function openBrowser(requireLogin = false) {
  const context = await chromium.launchPersistentContext(profileDir, { executablePath, headless: false, viewport: { width: 1320, height: 880 } });
  const page = context.pages()[0] || await context.newPage();
  await page.goto(`https://www.instagram.com/${owner}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (requireLogin) await page.locator('a[href*="/accounts/login/"], a[href*="/followers/"]').first().waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
  if (page.url().includes('/accounts/login') || await page.locator('input[name="username"]').count() || (requireLogin && await page.locator('a[href*="/accounts/login/"]').count())) {
    await context.close();
    throw new Error('Log in to Instagram in the visible companion browser, then run the command again. No password is handled by this app.');
  }
  return { context, page };
}

function checkPage(page) {
  const url = page.url();
  if (url.includes('/accounts/login') || url.includes('/challenge') || url.includes('/checkpoint')) throw new Error('Instagram requested login or verification; stopped.');
}

async function login() {
  const context = await chromium.launchPersistentContext(profileDir, { executablePath, headless: false, viewport: { width: 1320, height: 880 } });
  const page = context.pages()[0] || await context.newPage();
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    await page.goto(`https://www.instagram.com/${owner}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await prompt.question('Log in to Instagram yourself in the open Chrome window, then press Enter here: ');
    await page.goto(`https://www.instagram.com/${owner}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('a[href*="/accounts/login/"], a[href*="/followers/"]').first().waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
    if (await page.locator('a[href*="/accounts/login/"]').count()) throw new Error('Instagram still shows Log In. No session was saved.');
    console.log('Instagram session available in the private companion browser profile. No password was stored by this app.');
  } finally { prompt.close(); await context.close(); }
}

async function enrich() {
  const source = option('followers') || path.join(localDir, 'followers_1.json');
  const output = option('out') || path.join(localDir, 'profile-observations.json');
  const names = [...new Set((await followersFrom(source)).map(name => name.toLowerCase()))];
  const limit = Math.min(Number(option('limit') || names.length), names.length);
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Limit must be a positive integer.');
  let rows = [];
  try { rows = JSON.parse(await fs.readFile(output, 'utf8')); if (!Array.isArray(rows)) throw new Error('Invalid existing observations file.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const existing = new Set(rows.map(row => row.username?.toLowerCase()));
  const { context, page } = await openBrowser();
  let missingStreak = 0;
  try {
    for (const username of names.slice(0, limit)) {
      if (existing.has(username)) continue;
      await page.goto(`https://www.instagram.com/${encodeURIComponent(username)}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      checkPage(page);
      const description = await page.locator('meta[property="og:description"]').getAttribute('content').catch(() => null);
      const title = await page.locator('meta[property="og:title"]').getAttribute('content').catch(() => null);
      const record = parseProfileMetadata(username, description, title, stamp());
      const availableCounts = Object.entries(record).filter(([key, value]) => key.endsWith('_count') && value !== null).length;
      missingStreak = availableCounts ? 0 : missingStreak + 1;
      rows.push(record);
      await writeJsonAtomic(output, rows);
      console.log(`${rows.length}/${names.length} observed: @${username}, ${availableCounts} counts available`);
      if (missingStreak >= 3) throw new Error('Three profiles in a row had no public counts; stopped to avoid collecting challenge or error pages.');
      await page.waitForTimeout(4000);
    }
  } finally { await context.close(); }
  console.log(`Saved ${rows.length} observations to ${output}`);
}

async function remove() {
  const approvalFile = option('approval');
  if (!approvalFile) throw new Error('Provide --approval with a locally exported approval packet.');
  const packet = JSON.parse(await fs.readFile(approvalFile, 'utf8'));
  const targets = validateApproval(packet, owner);
  const sessionFile = option('session');
  if (has('execute') && !sessionFile) throw new Error('--execute requires --session with a fresh workspace backup exported after approval.');
  const journalFile = option('journal') || path.join(localDir, `action-journal-${packet.id}.json`);
  let journal;
  try {
    journal = JSON.parse(await fs.readFile(journalFile, 'utf8'));
    if (journal.id !== packet.id || journal.owner?.toLowerCase() !== owner.toLowerCase() || journal.targets?.length !== targets.length || journal.targets.some((name, index) => name.toLowerCase() !== targets[index].toLowerCase())) throw new Error('Existing action journal does not match the approval packet.');
    journal = recoverInterrupted(journal);
  }
  catch (error) { if (error.code !== 'ENOENT') throw error; journal = { version: 1, id: packet.id, owner, targets, createdAt: stamp(), events: [], states: Object.fromEntries(targets.map(name => [name.toLowerCase(), 'approved'])) }; }
  await writeJsonAtomic(journalFile, journal);
  const { context, page } = await openBrowser(true);
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    for (const username of targets) {
      const retryable = has('execute') ? ['approved', 'dry_run_ready'] : ['approved', 'dry_run_ready', 'not_found'];
      if (!retryable.includes(journal.states[username.toLowerCase()])) { console.log(`Skipping @${username}: ${journal.states[username.toLowerCase()]}`); continue; }
      await page.goto(`https://www.instagram.com/${owner}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      checkPage(page);
      const followersLink = page.getByRole('link', { name: /^[\d,.]+ followers$/i });
      await followersLink.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      if (await followersLink.count() !== 1) throw new Error('Follower list link not found uniquely; stopped.');
      await followersLink.click();
      const row = await findFollowerRow(page, username);
      if (!row) { journal = nextJournal(journal, { username, status: 'not_found', detail: 'Exact username not visible in follower search.' }); await writeJsonAtomic(journalFile, journal); continue; }
      if (!has('execute')) { journal = nextJournal(journal, { username, status: 'dry_run_ready', detail: 'Exact row and Remove control found; no click performed.' }); await writeJsonAtomic(journalFile, journal); continue; }
      assertExecutionApproved(JSON.parse(await fs.readFile(sessionFile, 'utf8')), packet, username);
      const answer = await prompt.question(`Type REMOVE @${username} to remove this follower: `);
      if (answer !== `REMOVE @${username}`) { journal = nextJournal(journal, { username, status: 'cancelled', detail: 'Operator did not confirm.' }); await writeJsonAtomic(journalFile, journal); continue; }
      journal = nextJournal(journal, { username, status: 'click_started', detail: 'Remove action initiated; result not yet verified.' });
      await writeJsonAtomic(journalFile, journal);
      try {
        await row.getByRole('button', { name: 'Remove', exact: true }).click();
        const confirmation = page.getByRole('dialog').last().getByRole('button', { name: 'Remove', exact: true });
        if (await confirmation.count() !== 1) throw new Error('Confirmation dialog not found uniquely.');
        await confirmation.click();
        await page.waitForTimeout(1800);
        checkPage(page);
        journal = nextJournal(journal, { username, status: 'ui_action_completed', detail: 'Instagram Remove confirmation clicked. Verify with a later complete follower export.' });
      } catch (error) {
        journal = nextJournal(journal, { username, status: 'unconfirmed', detail: `Action outcome uncertain: ${error.message}` });
        await writeJsonAtomic(journalFile, journal);
        throw error;
      }
      await writeJsonAtomic(journalFile, journal);
      await page.waitForTimeout(5000);
    }
  } finally { prompt.close(); await context.close(); }
  console.log(`Action journal: ${journalFile}`);
}

async function reconcile() {
  const journalFile = option('journal');
  const followerFile = option('followers');
  if (!journalFile || !followerFile) throw new Error('Provide --journal and a newer --followers export.');
  let journal = JSON.parse(await fs.readFile(journalFile, 'utf8'));
  const current = new Set((await followersFrom(followerFile)).map(name => name.toLowerCase()));
  for (const username of journal.targets) {
    const status = journal.states[username.toLowerCase()];
    if (status !== 'ui_action_completed' && status !== 'unconfirmed') continue;
    journal = nextJournal(journal, { username, status: current.has(username.toLowerCase()) ? 'still_in_later_export' : 'absent_in_later_export', detail: 'Compared with a later supplied follower export; absence does not prove why the relationship ended.' });
  }
  await writeJsonAtomic(journalFile, journal);
  console.log(`Reconciled ${journal.targets.length} targets in ${journalFile}`);
}

if (!['login', 'enrich', 'remove', 'reconcile'].includes(command) || (command !== 'reconcile' && !owner)) {
  console.error('Usage: npm run companion -- login --owner USER [--chrome PATH]');
  console.error('Usage: npm run companion -- enrich --owner USER [--followers FILE] [--limit N] [--chrome PATH]');
  console.error('       npm run companion -- remove --owner USER --approval FILE [--execute --session FRESH_BACKUP.json] [--chrome PATH]');
  console.error('       npm run companion -- reconcile --journal FILE --followers NEW_EXPORT.json');
  process.exitCode = 1;
} else {
  try { await ({ login, enrich, remove, reconcile })[command](); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
