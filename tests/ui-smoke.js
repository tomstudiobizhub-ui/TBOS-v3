const { chromium } = require('playwright');

const pages = [
  'index.html', 'dashboard.html', 'admin.html', 'admin-gate.html',
  'clients.html', 'inventory.html', 'jobs.html', 'knowledge.html',
  'offline.html', 'register.html', 'reports.html', 'staff.html'
];
const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1365, height: 900 }
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  const summary = [];
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      for (const route of pages) {
        const page = await context.newPage();
        const pageErrors = [];
        const badLocalResponses = [];
        page.on('pageerror', error => pageErrors.push(error.message));
        page.on('response', response => {
          const url = response.url();
          if (url.startsWith('http://127.0.0.1:4173/') && response.status() >= 400) {
            badLocalResponses.push({ status: response.status(), url });
          }
        });

        try {
          // Seed a non-sensitive demo profile so protected pages can render their UI
          // during layout tests without using any real account or password.
          if (!['index.html', 'register.html', 'offline.html'].includes(route)) {
            await page.addInitScript(() => {
              localStorage.setItem('currentUser', JSON.stringify({ id: 'ui-smoke-test', name: 'UI Test', email: 'ui-test@example.invalid', role: 'Administrator', hub: 'Test Hub', status: 'Active' }));
              localStorage.setItem('currentStaffId', 'ui-smoke-test');
            });
          }
          await page.goto(`http://127.0.0.1:4173/${route}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await page.waitForTimeout(700);
          const result = await page.evaluate(() => {
            const viewportWidth = document.documentElement.clientWidth;
            const overflowing = [];
            for (const el of document.querySelectorAll('body *')) {
              if (!(el instanceof HTMLElement)) continue;
              const style = getComputedStyle(el);
              if (style.display === 'none' || style.visibility === 'hidden') continue;
              const rect = el.getBoundingClientRect();
              if (rect.width < 1 || rect.height < 1) continue;
              if (rect.right <= viewportWidth + 2 || rect.left < -viewportWidth) continue;
              let scrollableParent = el;
              let insideScroller = false;
              while (scrollableParent && scrollableParent !== document.body) {
                const overflowX = getComputedStyle(scrollableParent).overflowX;
                if (overflowX === 'auto' || overflowX === 'scroll') { insideScroller = true; break; }
                scrollableParent = scrollableParent.parentElement;
              }
              if (!insideScroller) overflowing.push({
                tag: el.tagName.toLowerCase(),
                id: el.id || '',
                className: typeof el.className === 'string' ? el.className.slice(0, 80) : '',
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                width: Math.round(rect.width)
              });
            }
            return {
              title: document.title,
              viewportWidth,
              documentWidth: document.documentElement.scrollWidth,
              bodyWidth: document.body.scrollWidth,
              overflowElements: overflowing.slice(0, 12)
            };
          });
          const problems = [];
          if (!result.title) problems.push('missing document title');
          if (result.documentWidth > viewport.width + 2) problems.push(`document width ${result.documentWidth}px exceeds viewport ${viewport.width}px`);
          if (result.overflowElements.length) problems.push(`${result.overflowElements.length}+ visible elements extend beyond viewport`);
          if (pageErrors.length) problems.push(`uncaught page errors: ${pageErrors.join(' | ')}`);
          if (badLocalResponses.length) problems.push(`local HTTP errors: ${JSON.stringify(badLocalResponses)}`);
          const row = { page: route, viewport: viewport.name, result, problems };
          summary.push(row);
          if (problems.length) failures.push(row);
          await page.screenshot({ path: `test-results/${route.replace('.html','')}-${viewport.name}.png`, fullPage: true }).catch(() => {});
        } catch (error) {
          const row = { page: route, viewport: viewport.name, problems: [error.message] };
          summary.push(row);
          failures.push(row);
        } finally {
          await page.close();
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify({ tested: summary.length, failures: failures.length, results: summary, failedCases: failures }, null, 2));
  if (failures.length) process.exit(1);
})().catch(error => { console.error(error); process.exit(1); });
