import { expect, test, type Page } from '@playwright/test';

import { expectNoHorizontalOverflow, gotoShellPage, viewports } from './support';

// Characterization of the legacy Settings page (/settings) ahead of its React
// port (fork issue #1). Settings is the touchiest legacy page: it hydrates
// every field from GET /api/settings, auto-saves the WHOLE form on any edit
// (debounced 2s), and has burned users before — #879 (a failed load blanking
// the real config on the next save) and #827 (the Logs tab flooding app.log
// with auto-saves). The network-level contracts below are the ones a port
// must not break.

/** POST /api/settings observed since attach — the auto-save signal. */
function trackSettingsSaves(page: Page): { count: () => number } {
  let saves = 0;
  page.on('request', (req) => {
    if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/settings') saves += 1;
  });
  return { count: () => saves };
}

const TABS = ['connections', 'downloads', 'quality', 'library', 'appearance', 'advanced', 'logs'];

for (const viewport of viewports) {
  test.describe(`settings page at ${viewport.name} (${viewport.width}px)`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test.beforeEach(async ({ page, baseURL }) => {
      test.skip(!baseURL, 'needs a live server');
      await gotoShellPage(page, baseURL!, '/settings', 'settings');
      // Wait for hydration: fields populate (and the auto-save listeners
      // attach) only after GET /api/settings lands. An edit made before that
      // is invisible to auto-save — real characterization finding, so the
      // spec always edits post-hydration, like a user would.
      await expect
        .poll(async () =>
          page.evaluate(
            () => (document.getElementById('metadata-fallback-source') as HTMLSelectElement).value,
          ),
        )
        .not.toBe('');
      await page.waitForTimeout(500);
    });

    test('renders the tab bar with Connections active and only its groups visible', async ({
      page,
    }) => {
      const tabs = page.locator('.stg-tabbar .stg-tab');
      await expect(tabs).toHaveCount(TABS.length);
      for (const tab of TABS) {
        await expect(page.locator(`.stg-tab[data-tab="${tab}"]`)).toBeAttached();
      }
      await expect(page.locator('.stg-tab.active')).toHaveAttribute('data-tab', 'connections');

      // Connections content visible, another tab's content hidden.
      await expect(page.locator('#metadata-fallback-source')).toBeVisible();
      await expect(page.locator('#download-path')).toBeHidden();
      await expect(page.locator('#save-settings')).toBeVisible();
    });

    test('switching tabs swaps which groups are shown', async ({ page }) => {
      await page.locator('.stg-tab[data-tab="downloads"]').click();
      await expect(page.locator('.stg-tab.active')).toHaveAttribute('data-tab', 'downloads');
      // Downloads content arrives as collapsed sections — the header shows,
      // its body doesn't until clicked.
      const sourceHeader = page.locator('.settings-section-header[data-stg="downloads"]', {
        hasText: 'Source Settings',
      });
      await expect(sourceHeader).toBeVisible();
      await expect(page.locator('#download-source-mode')).toBeHidden();
      await sourceHeader.click();
      await expect(page.locator('#download-source-mode')).toBeVisible();
      await expect(page.locator('#metadata-fallback-source')).toBeHidden();
      // The save button lives outside the tab panels and survives switching.
      await expect(page.locator('#save-settings')).toBeVisible();
    });

    test('hydrating the form never fires a save', async ({ page, baseURL }) => {
      // The page populates every field programmatically on load; the
      // suppression flag must swallow those synthetic change events. A port
      // that re-fires them would rewrite config.json on every page VIEW
      // (#879's blast radius). 3.5s ≫ the 2s debounce window.
      const saves = trackSettingsSaves(page);
      const hydrated = page.waitForResponse(
        (r) => new URL(r.url()).pathname === '/api/settings' && r.request().method() === 'GET',
      );
      await page.goto(new URL('/settings', baseURL!).toString(), {
        waitUntil: 'domcontentloaded',
      });
      await hydrated;
      await page.waitForTimeout(3500);
      expect(saves.count()).toBe(0);
    });

    test('one edit auto-saves exactly once, debounced', async ({ page }) => {
      const saves = trackSettingsSaves(page);
      await page.locator('#metadata-fallback-source').selectOption('itunes');
      // Within the debounce window nothing has fired yet…
      await page.waitForTimeout(1000);
      expect(saves.count()).toBe(0);
      // …then the single quiet save lands.
      await expect.poll(() => saves.count(), { timeout: 4000 }).toBe(1);
      await page.waitForTimeout(1500);
      expect(saves.count()).toBe(1);
    });

    test('media-server toggle swaps the visible config container', async ({ page }) => {
      await expect(page.locator('#plex-container')).toBeVisible();
      await expect(page.locator('#jellyfin-container')).toBeHidden();
      await page.locator('#jellyfin-toggle').click();
      await expect(page.locator('#jellyfin-toggle')).toHaveClass(/active/);
      await expect(page.locator('#jellyfin-container')).toBeVisible();
      await expect(page.locator('#plex-container')).toBeHidden();
    });

    test('path inputs ship locked and Unlock opens them for editing', async ({ page }) => {
      // The folder paths live on the LIBRARY tab under the collapsed
      // "Paths & Organization" section (upstream's folder-paths rework moved
      // them; the port must keep them there).
      await page.locator('.stg-tab[data-tab="library"]').click();
      const header = page.locator('.settings-section-header[data-stg="library"]', {
        hasText: 'Paths & Organization',
      });
      await header.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await header.click();
      const input = page.locator('#download-path');
      await input.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await expect(input).toBeVisible();
      await expect(input).toHaveAttribute('readonly', '');
      const unlock = page.locator('button[onclick*="togglePathLock(\'download\'"]');
      await expect(unlock).toHaveText('Unlock');
      await unlock.click();
      await expect(input).not.toHaveAttribute('readonly', '');
      await expect(unlock).toHaveText('Lock');
    });

    test('the Logs tab never auto-saves (#827)', async ({ page }) => {
      const saves = trackSettingsSaves(page);
      await page.locator('.stg-tab[data-tab="logs"]').click();
      // Poke a control while Logs is active — the viewer's pickers must not
      // count as settings edits.
      const select = page.locator('#settings-page [data-stg="logs"] select').first();
      if (await select.count()) {
        await select.selectOption({ index: 0 });
      }
      await page.waitForTimeout(3000);
      expect(saves.count()).toBe(0);
    });

    test('no horizontal overflow on the dense tabs', async ({ page }) => {
      await expectNoHorizontalOverflow(page, `settings connections @${viewport.width}`);
      await page.locator('.stg-tab[data-tab="downloads"]').click();
      await page.waitForTimeout(300);
      await expectNoHorizontalOverflow(page, `settings downloads @${viewport.width}`);
    });
  });
}
