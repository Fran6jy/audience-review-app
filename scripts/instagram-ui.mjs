export async function findFollowerRow(page, username) {
  const dialog = page.getByRole('dialog');
  await dialog.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  if (await dialog.count() !== 1) throw new Error('Follower dialog was not found uniquely.');
  const search = dialog.locator('input[placeholder*="Search"], input[aria-label*="Search"]');
  await search.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  if (await search.count() !== 1) throw new Error('Follower search field was not found uniquely.');
  await search.fill(username);
  const link = dialog.getByRole('link', { name: username, exact: true });
  await link.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await link.count() !== 1 || await link.getAttribute('href') !== `/${username}/`) return null;
  const row = link.locator('xpath=ancestor::div[.//*[@role="button" and normalize-space()="Remove"] or .//button[normalize-space()="Remove"]][1]');
  const hrefs = await row.locator('a[href^="/"]').evaluateAll(anchors => [...new Set(anchors.map(anchor => anchor.getAttribute('href')))]);
  if (await row.count() !== 1 || hrefs.length !== 1 || hrefs[0] !== `/${username}/` || await row.getByRole('button', { name: 'Remove', exact: true }).count() !== 1) throw new Error('Exact account row could not be isolated safely.');
  return row;
}
