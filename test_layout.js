const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file:///Users/chiikoba/Desktop/noi-portfolio/index.html', { waitUntil: 'networkidle0' });
  const logoVisible = await page.evaluate(() => {
    const el = document.querySelector('body > .logo');
    if (!el) return 'No logo element found';
    return window.getComputedStyle(el).display;
  });
  console.log('Logo display:', logoVisible);
  await browser.close();
})();
