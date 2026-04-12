const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('1. Navigating to /products...');
  await page.goto('http://localhost:3005/products', { timeout: 30000 });
  await page.wait_for_load_state('networkidle');
  console.log('✓ Products page loaded');

  // Screenshot
  await page.screenshot({ path: '/Users/madearga/Desktop/crm/screenshots/products-list.png', fullPage: true });
  console.log('✓ Screenshot saved: products-list.png');

  // Get page content for verification
  const content = await page.textContent('body');
  console.log('Page content preview:', content.substring(0, 500));

  await browser.close();
  console.log('✓ Test complete');
})();