import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  
  // Navigate to login first or set localstorage maybe? No, need token.
  // We can just open the page, if it crashes on render, it will complain.
  // Actually, we need to login first to see event details if it's protected.
  // Let's just create a dummy token or bypass if it's a runtime error on component mount.
  // Alternatively, I can login and navigate!
  
  await page.goto('http://localhost:5173/login');
  // fill form
  await page.type('input[type="email"]', 'rohan@example.com'); // We need a valid test user
  // Let's just log pageerror, even without login, the error might be exposed if the component is mounted loosely or we can just see what throws.
  
  await browser.close();
})();
