import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

mkdirSync('/opt/cursor/artifacts/screenshots', { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

async function shot(path, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.screenshot({ path, fullPage: false });
  console.log('saved', path, page.url());
}

await shot('/opt/cursor/artifacts/screenshots/home.png', 'http://localhost:3000/');
await shot('/opt/cursor/artifacts/screenshots/demo.png', 'http://localhost:3000/demo');
await shot('/opt/cursor/artifacts/screenshots/booking.png', 'http://localhost:3000/book/cleancar-demo');

// Submit a booking request
await page.goto('http://localhost:3000/book/cleancar-demo', { waitUntil: 'networkidle' });
await page.fill('#name', 'Pat Demo');
await page.fill('#email', 'pat.demo@example.com');
await page.fill('#phone', '+353861234567');
const make = page.locator('#vehicleMake, [name="vehicleMake"]').first();
if (await make.count()) await make.fill('Ford');
const model = page.locator('#vehicleModel, [name="vehicleModel"]').first();
if (await model.count()) await model.fill('Focus');
const size = page.locator('#vehicleSize, [name="vehicleSize"]').first();
if (await size.count()) await size.selectOption({ index: 1 }).catch(() => {});
await page.locator('button', { hasText: /Submit|Request|Send/i }).first().click();
await page.waitForTimeout(2500);
await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/booking-success.png' });
console.log('booking submit', page.url());

await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
await page.fill('#email', 'demo@cleancar.ie');
await page.fill('#password', 'password123');
await page.getByRole('button', { name: /log in/i }).click();
await page.waitForTimeout(3000);
await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/dashboard.png' });
console.log('after login', page.url());

await page.goto('http://localhost:3000/dashboard/enquiries', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/enquiries.png' });
console.log('enquiries', page.url());

await page.goto('http://localhost:3000/dashboard/calendar', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/calendar.png' });
console.log('calendar', page.url());

await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/dashboard-mobile.png' });
console.log('mobile', page.url());

await browser.close();
