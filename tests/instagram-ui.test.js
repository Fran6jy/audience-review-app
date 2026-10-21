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
