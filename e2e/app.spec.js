const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

async function addLearner(page, name = 'Ola') {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Who is practising?' })).toBeVisible();
  await page.getByLabel('New here? Enter your name').fill(name);
  await page.getByRole('button', { name: 'Add learner' }).click();
  await expect(page.locator('#header-nick')).toHaveText(name);
}

test('learner picker keeps focus inside and activity tiles are links', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#input-nick')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => document.activeElement.closest('#auth-modal') !== null)).toBe(true);

  await page.getByLabel('New here? Enter your name').fill('Ola');
  await page.getByRole('button', { name: 'Add learner' }).click();
  await expect(page.getByRole('link', { name: 'Multiplication: start practising' })).toBeVisible();

  await page.getByRole('button', { name: 'Switch learner' }).click();
  await expect(page.getByRole('dialog', { name: 'Who is practising?' })).toBeVisible();
  await page.locator('#auth-modal').getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('button', { name: 'Switch learner' })).toBeFocused();
});

test('practice length stays inline and saves the selected minutes on phones', async ({ page }) => {
  await addLearner(page);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 740 });
    const label = page.getByText('Practice length');
    const options = page.getByRole('group', { name: 'Session length in minutes' });
    const [labelBox, optionsBox] = await Promise.all([label.boundingBox(), options.boundingBox()]);
    expect(Math.abs(labelBox.y + labelBox.height / 2 - optionsBox.y - optionsBox.height / 2)).toBeLessThan(1);
    expect(Math.abs(labelBox.x + labelBox.width - optionsBox.x)).toBeLessThan(1);
    expect(await page.evaluate(() => {
      const label = document.querySelector('.header-duration-label');
      const options = document.querySelector('.duration-options');
      return getComputedStyle(label).backgroundColor === getComputedStyle(options).backgroundColor;
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const boxes = await options.getByRole('button').evaluateAll(buttons =>
      buttons.map(button => {
        const box = button.getBoundingClientRect();
        return { y: box.y, width: box.width };
      })
    );
    expect(boxes.every(box => box.y === boxes[0].y && box.width >= 44)).toBe(true);
  }
  await page.getByRole('button', { name: '3 minutes' }).click();
  await expect(page.locator('#settings-status')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '3 minutes' })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: '3 minutes' })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.language-toggle').first().click();
  await expect(page.getByText('Czas ćwiczeń')).toBeVisible();
  await expect(page.getByRole('button', { name: '3 minuty' })).toHaveAttribute('aria-pressed', 'true');
});

test('progress controls and detail dialog work from the keyboard', async ({ page }) => {
  await addLearner(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/progress');

  const controls = page.getByRole('group', { name: 'Practice type' });
  await expect(controls).toBeVisible();
  const division = controls.getByRole('button', { name: 'Division' });
  await division.click();
  await expect(division).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#div-panel')).toBeVisible();

  const cell = page.locator('#div-grid .cell').first();
  await cell.click();
  const close = page.getByRole('button', { name: 'Close' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#cell-modal')).toBeHidden();
  await expect(cell).toBeFocused();
});

test('narrow layouts fit every review and Progress grid without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await addLearner(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.locator('.language-toggle').first().click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await page.goto('/review-multiply');
  const grid = page.locator('.grid-scroll');
  expect(await grid.evaluate(element => element.scrollWidth)).toBe(await grid.evaluate(element => element.clientWidth));
  expect(parseFloat(await page.locator('#mult-grid .cell').first().evaluate(element => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(11.5);
  await page.getByRole('button', { name: '10×10: nieoznaczone' }).click();
  await expect(page.locator('#num-green')).toHaveText('1');
  expect(await grid.evaluate(element => element.scrollLeft)).toBe(0);
  await expect(page.locator('#mult-grid .header-cell')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Nauka / powtórka: mnożenie' })).toBeVisible();

  await page.goto('/review-divide');
  await expect(page.locator('#div-grid .header-cell')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Nauka / powtórka: dzielenie' })).toBeVisible();
  expect(await page.locator('.grid-scroll').evaluate(element => element.scrollWidth)).toBe(await page.locator('.grid-scroll').evaluate(element => element.clientWidth));

  await page.goto('/progress');
  await expect(page.locator('.nav-heading')).toHaveCount(0);
  for (const id of ['mult-panel', 'div-panel', 'missing-panel']) {
    await page.locator('.tab[data-panel="' + id + '"]').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    const panel = page.locator('.panel:visible');
    expect(await panel.locator('.grid-scroll').evaluate(element => element.scrollWidth)).toBe(await panel.locator('.grid-scroll').evaluate(element => element.clientWidth));
    await expect(panel.locator('.stat-chip')).toHaveCount(4);
    await expect(panel.locator('.header-cell')).toHaveCount(0);
    const expectedExpression = {
      'mult-panel': /^1×1,/,
      'div-panel': /^1÷1,/,
      'missing-panel': /^1×_=1,/,
    }[id];
    await expect(panel.locator('.cell').first()).toHaveAttribute('aria-label', expectedExpression);
    const [first, third] = await Promise.all([
      panel.locator('.stat-chip').nth(0).boundingBox(),
      panel.locator('.stat-chip').nth(2).boundingBox(),
    ]);
    expect(third.y).toBeGreaterThan(first.y);
  }
});

test('practice results show up in progress and stay after a reload', async ({ page }) => {
  await addLearner(page);
  await page.goto('/multiplication');
  const question = await page.locator('#question').textContent();
  const [a, b] = question.match(/\d+/g).map(Number);
  await page.locator('#answer-input').fill(String(a * b));
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('#feedback')).toHaveText('✓ Correct!');

  await page.goto('/progress');
  await expect(page.getByRole('heading', { name: 'Multiplication Mastery' })).toBeVisible();
  const practised = page.locator('#mult-panel .cell:not([data-progress="none"])');
  await expect(practised).not.toHaveCount(0);
  await page.reload();
  await expect(practised).not.toHaveCount(0);
});

test('learn / review marks are saved on the device', async ({ page }) => {
  await addLearner(page);
  await page.goto('/review-divide');
  await page.getByRole('button', { name: /^56÷7:/ }).click();
  await expect(page.locator('#num-green')).toHaveText('1');
  await page.reload();
  await expect(page.locator('#num-green')).toHaveText('1');
  await expect(page.getByRole('button', { name: '56÷7: knows' })).toBeVisible();
});

test('a backup file restores learners in a fresh browser', async ({ page, browser }) => {
  await addLearner(page, 'Tomek');
  await page.goto('/missing-factor');
  const question = await page.locator('#question').textContent();
  const [factor, product] = question.match(/\d+/g).map(Number);
  await page.locator('#answer-input').fill(String(product / factor));
  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toHaveText('✓ Correct!');

  await page.goto('/');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save backup' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^divide-and-conquer-backup-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(page.locator('#backup-status')).toContainText('Last backup:');
  const backupPath = await download.path();
  expect(JSON.parse(fs.readFileSync(backupPath, 'utf8')).profiles).toHaveLength(1);

  const fresh = await browser.newPage();
  await fresh.goto('/');
  const chooserPromise = fresh.waitForEvent('filechooser');
  await fresh.getByRole('button', { name: 'Restore from a backup file' }).click();
  await (await chooserPromise).setFiles(backupPath);
  await fresh.getByRole('button', { name: 'Tomek' }).click();
  await expect(fresh.locator('#header-nick')).toHaveText('Tomek');
  await fresh.goto('/progress');
  await expect(fresh.locator('#missing-panel .cell:not([data-progress="none"])')).not.toHaveCount(0);
  await fresh.close();
});

test('a file that is not a backup is rejected', async ({ page }, testInfo) => {
  const badFile = testInfo.outputPath('not-a-backup.json');
  fs.writeFileSync(badFile, JSON.stringify({ hello: 'world' }));
  await page.goto('/');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Restore from a backup file' }).click();
  await (await chooserPromise).setFiles(badFile);
  await expect(page.locator('#new-user-error')).toHaveText('That file is not a Divide & Conquer backup.');
});

test('switching and deleting learners', async ({ page }) => {
  await addLearner(page, 'Ola');
  await page.getByRole('button', { name: 'Switch learner' }).click();
  await page.getByLabel('New here? Enter your name').fill('Tomek');
  await page.getByRole('button', { name: 'Add learner' }).click();
  await expect(page.locator('#header-nick')).toHaveText('Tomek');

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete learner' }).click();
  await expect(page.getByRole('heading', { name: 'Who is practising?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tomek' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ola' }).click();
  await expect(page.locator('#header-nick')).toHaveText('Ola');
});

test('practice pages send a new visitor to the learner picker', async ({ page }) => {
  await page.goto('/division');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Who is practising?' })).toBeVisible();
});

test('the theme switch cycles light, dark and system', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await addLearner(page);
  const html = page.locator('html');
  const toggle = page.locator('.theme-toggle');
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(toggle).toHaveAttribute('aria-label', 'Switch to light mode');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-label', 'Switch to dark mode');
  await toggle.click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-label', 'Follow the system theme');
  await toggle.click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => localStorage.getItem('divide-and-conquer-theme'))).toBeNull();
});

test('the app is installable and works offline', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);

  const manifest = await page.evaluate(async () => {
    const response = await fetch('/manifest.webmanifest');
    return { type: response.headers.get('content-type'), body: await response.json() };
  });
  expect(manifest.type).toContain('application/manifest+json');
  expect(manifest.body.start_url).toBe('/');
  expect(manifest.body.display).toBe('standalone');
  expect(manifest.body.icons.map(icon => icon.sizes)).toContain('512x512');
  expect(manifest.body.icons.some(icon => icon.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.body.icons) {
    const status = await page.evaluate(async src => (await fetch(src)).status, icon.src);
    expect(status, icon.src).toBe(200);
  }

  await addLearner(page, 'Ola');
  await page.goto('/multiplication/');
  await expect(page.locator('#question')).not.toBeEmpty();

  // Wait for the worker to be active, to control this page, and to finish
  // filling the cache, then cut the network.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
  });
  await expect.poll(
    async () => page.evaluate(async () => {
      const [name] = await caches.keys();
      return name ? (await (await caches.open(name)).keys()).length : 0;
    }),
    { timeout: 15_000 }
  ).toBeGreaterThan(40);
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.locator('#question')).not.toBeEmpty();
    await page.goto('/');
    await expect(page.locator('#header-nick')).toHaveText('Ola');
    // The home tiles link to the bare paths, which the host redirects to the slashed ones.
    await page.goto('/multiplication');
    await expect(page.locator('#question')).not.toBeEmpty();
    await page.goto('/progress');
    await expect(page).toHaveTitle(/Progress/i);
    // The footer links to privacy.html, which the host redirects to /privacy.
    await page.goto('/privacy.html');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Data and privacy');
  } finally {
    await context.setOffline(false);
  }
});

test('the footer credits Kuba and the page logs no errors', async ({ page }) => {
  const outside = [];
  const errors = [];
  page.on('request', request => {
    if (!request.url().startsWith('http://localhost:40451')) outside.push(request.url());
  });
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

  const response = await page.goto('/');
  expect(response.headers()['content-security-policy']).toContain("default-src 'self'");
  await addLearner(page);
  const credit = page.locator('.footer-credit');
  await expect(credit).toHaveText('Divide & Conquer v1.00 by Kuba · tinkered.app · Privacy');
  await expect(credit.getByRole('link', { name: 'Kuba' })).toHaveAttribute('href', 'mailto:kuba@tinkered.app');
  await expect(credit.getByRole('link', { name: 'tinkered.app' })).toHaveAttribute('href', 'https://tinkered.app');
  await expect(credit.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', 'privacy.html');

  await page.locator('.site-header').getByRole('button', { name: 'Przełącz na polski' }).click();
  await expect(page.locator('#device-data')).toContainText('ekranu początkowego');
  await page.goto('/multiplication');
  await page.goto('/progress');
  await page.goto('/privacy');

  // Requests to other origins are a warning, not a failure: avoiding them is a goal, not a hard limit.
  for (const url of outside) {
    test.info().annotations.push({ type: 'warning', description: `third-party request: ${url}` });
    console.warn(`warning: third-party request: ${url}`);
  }
  expect(errors).toEqual([]);
});

test('the footer links to a privacy page that search engines skip', async ({ page }) => {
  await addLearner(page);
  await page.locator('.footer-credit').getByRole('link', { name: 'Privacy' }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Data and privacy');
  await expect(page).toHaveTitle('Data and privacy | Divide & Conquer');

  // The language chosen in the app carries over, and the toggle switches the note.
  await page.locator('.site-header').getByRole('button', { name: 'Przełącz na polski' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dane i prywatność');
  await expect(page.locator('article[data-locale="en"]')).toBeHidden();

  await page.locator('.site-header .logo').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.footer-credit').getByRole('link', { name: 'Prywatność' })).toBeVisible();
});

test('the privacy page is sent with a noindex header', async ({ request }) => {
  for (const url of ['/privacy', '/privacy.html']) {
    const response = await request.get(url, { maxRedirects: 0 });
    expect(response.headers()['x-robots-tag'], url).toBe('noindex');
  }
});
