export async function findFollowerRow(page, username) {
  const dialog = page.getByRole('dialog');
  if (await dialog.count() !== 1) throw new Error('Follower dialog was not found uniquely.');
  const search = dialog.locator('input[placeholder*="Search"], input[aria-label*="Search"]');
  if (await search.count() !== 1) throw new Error('Follower search field was not found uniquely.');
  await search.fill(username);
  await page.waitForTimeout(1200);
  const link = dialog.locator(`a[href="/${username}/"]`);
  if (await link.count() !== 1) return null;
  const row = link.locator('xpath=ancestor::div[.//button[normalize-space()="Remove"]][1]');
  if (await row.count() !== 1 || await row.locator('a[href^="/"]').count() !== 1 || await row.getByRole('button', { name: 'Remove', exact: true }).count() !== 1) throw new Error('Exact account row could not be isolated safely.');
  return row;
}
