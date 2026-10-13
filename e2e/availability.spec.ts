import { expect, Page, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const JEN = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
async function fixture(page: Page, width: number, theme = 'light', many = false) {
  await page.setViewportSize({ width, height: 844 });
  const user = { id: OWNER, email: 'availability-test@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const token = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ sub: OWNER, exp: 2000000000, role: 'authenticated' })).toString('base64url') + '.test-only';
  await page.addInitScript(({ user, token }) => localStorage.setItem('sb-rosofbnimiothwxsabyr-auth-token', JSON.stringify({ access_token: token, refresh_token: 'mock-only', expires_at: 2000000000, expires_in: 999999, user, token_type: 'bearer' })), { user, token });
  const db: Record<string, Record<string, unknown>[]> = {
    team_members: [{ id: JEN, name: 'Jen', color: '#ede8d8', points: 0, badges: [], created_at: '2026-10-10' }],
    categories: [], chores: [], chore_completions: [],
    member_availability: many ? Array.from({ length: 16 }, (_, index) => ({ id: `away-${index}`, member_id: JEN, start_date: '2026-10-12', end_date: '2026-10-14', reason: `Family trip ${index + 1}: ${'long note '.repeat(12)}` })) : [],
  };
  let fail = false;
  const writes: { method: string; table: string }[] = [];
  await page.route('**/*.supabase.co/**', async route => {
    const request = route.request(), url = new URL(request.url()), table = url.pathname.split('/').pop()!, method = request.method();
    if (url.pathname.includes('/auth/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
    if (!url.pathname.includes('/rest/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    if (method !== 'GET') {
      writes.push({ method, table });
      if (fail) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Synthetic network failure', code: 'TEST_ONLY' }) });
    }
    let result: unknown = db[table] || [];
    if (method === 'POST') {
      const item = { id: crypto.randomUUID(), created_at: '2026-10-10', ...request.postDataJSON() };
      db[table] ||= []; db[table].push(item); result = item;
    }
    if (method === 'DELETE') {
      const id = url.searchParams.get('id')?.replace(/^eq\./, '');
      db[table] = db[table].filter(item => item.id !== id); result = [];
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
  });
  await page.goto(`/chore-app/?theme=${theme}`);
  await expect(page.getByRole('button', { name: 'Open family menu' })).toBeVisible();
  return { writes, fail: () => { fail = true; }, recover: () => { fail = false; } };
}
async function openAvailability(page: Page) {
  await page.getByRole('button', { name: 'Open family menu' }).click();
  await page.getByRole('combobox', { name: 'Actions for Jen' }).click();
  await page.getByRole('option', { name: 'Availability', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Jen’s availability' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.locator('.family-panel')).toHaveCount(0);
  return dialog;
}

for (const width of [320, 390, 1440]) for (const theme of ['light', 'dark']) {
  test(`availability layout and dismissal ${theme} ${width}`, async ({ page }, info) => {
    const { writes } = await fixture(page, width, theme);
    const dialog = await openAvailability(page);
    const start = dialog.getByLabel('Start date'), end = dialog.getByLabel('End date');
    const startBox = (await start.boundingBox())!, endBox = (await end.boundingBox())!, box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(16);
    expect(box.x + box.width).toBeLessThanOrEqual(width - 15);
    expect(box.y).toBeGreaterThanOrEqual(16);
    expect(box.y + box.height).toBeLessThanOrEqual(829);
    if (width < 520) expect(endBox.y).toBeGreaterThan(startBox.y + startBox.height);
    else expect(endBox.y).toBe(startBox.y);
    for (const input of [start, end]) {
      await expect(input).toHaveCSS('font-size', '16px');
      expect(await input.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`availability-${theme}-${width}.png`) });
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    await openAvailability(page);
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await expect(dialog).toHaveCount(0);
    expect(writes).toHaveLength(0);
  });
}

test('availability saves dates, retains failed input and retries removal', async ({ page }) => {
  const controls = await fixture(page, 390);
  const dialog = await openAvailability(page);
  await dialog.getByRole('button', { name: 'Add dates', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Choose a start and end date.');
  await dialog.getByLabel('Start date').fill('2026-10-14');
  await dialog.getByLabel('End date').fill('2026-10-12');
  await dialog.getByRole('button', { name: 'Add dates', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('End date must be on or after the start date.');
  expect(controls.writes).toHaveLength(0);
  await dialog.getByLabel('End date').fill('2026-10-14');
  await dialog.getByLabel('Reason (optional)').fill('Family trip');
  controls.fail();
  await dialog.getByRole('button', { name: 'Add dates', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Could not save availability. Please try again.');
  await expect(dialog.getByLabel('Start date')).toHaveValue('2026-10-14');
  await expect(dialog.getByLabel('End date')).toHaveValue('2026-10-14');
  await expect(dialog.getByLabel('Reason (optional)')).toHaveValue('Family trip');
  controls.recover();
  await dialog.getByRole('button', { name: 'Add dates', exact: true }).click();
  await expect(dialog.getByText('Family trip', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Start date')).toHaveValue('');
  await expect(dialog.getByLabel('Reason (optional)')).toHaveValue('');
  controls.fail();
  await dialog.getByRole('button', { name: 'Remove dates Oct 14, 2026' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Could not delete availability. Please try again.');
  await expect(dialog.getByText('Family trip', { exact: true })).toBeVisible();
  controls.recover();
  await dialog.getByRole('button', { name: 'Remove dates Oct 14, 2026' }).click();
  await expect(dialog.getByText('No unavailable dates yet.')).toBeVisible();
});

test('availability keeps the header reachable and scrolls long content on a short viewport', async ({ page }, info) => {
  await fixture(page, 390, 'dark', true);
  const dialog = await openAvailability(page);
  await page.setViewportSize({ width: 390, height: 420 });
  const body = dialog.locator('.chore-dialog-body');
  expect(await body.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  expect(await body.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  const header = (await dialog.locator('.chore-dialog-header').boundingBox())!;
  const box = (await dialog.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(16);
  expect(box.y + box.height).toBeLessThanOrEqual(405);
  await body.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(dialog.getByText(/^Family trip 16:/)).toBeVisible();
  expect((await dialog.locator('.chore-dialog-header').boundingBox())!.y).toBe(header.y);
  await page.screenshot({ path: info.outputPath('availability-dark-short-long-content.png') });
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(dialog).toHaveCount(0);
});
