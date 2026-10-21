import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { findFollowerRow } from '../scripts/instagram-ui.mjs';

test('isolates the exact account row and never a neighbouring Remove button', async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<div role="dialog"><input placeholder="Search"><div><a href="/alice/">alice</a><button>Remove</button></div><div><a href="/bob/">bob</a><button>Remove</button></div></div>');
    const row = await findFollowerRow(page, 'alice');
    assert.equal(await row.getByRole('link').innerText(), 'alice');
    assert.equal(await findFollowerRow(page, 'missing'), null);
    await page.close();
  } finally { await browser.close(); }
});

test('accepts avatar and username links to the same exact profile', async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<div role="dialog"><input aria-label="Search input"><div><a href="/alice/"><img alt=""></a><a href="/alice/">alice</a><div role="button">Remove</div></div><div><a href="/alice2/">alice2</a><div role="button">Remove</div></div></div>');
    const row = await findFollowerRow(page, 'alice');
    assert.equal(await row.getByRole('button', { name: 'Remove' }).count(), 1);
    assert.equal(await row.getByRole('link', { name: 'alice', exact: true }).count(), 1);
  } finally { await browser.close(); }
});
