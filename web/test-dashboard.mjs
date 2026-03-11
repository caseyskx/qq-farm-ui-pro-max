import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('http://localhost:5173/login');
  await new Promise(r => setTimeout(r, 2000));
  // 注入 localstorage
  await page.evaluate(() => {
    localStorage.setItem('admin_token', 'test_token');
    localStorage.setItem('core_account_id', '1234');
    localStorage.setItem('current_account_id', '1234');
  });

  await page.goto('http://localhost:5173/dashboard');
  await new Promise(resolve => setTimeout(resolve, 5000));

  await browser.close();
})();
