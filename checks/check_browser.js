const puppeteer = require('puppeteer');
(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
        page.on('requestfailed', req => console.log('REQ FAILED:', req.url(), req.failure().errorText));

        await page.goto('http://127.0.0.1:8080/ficha/1', { waitUntil: 'load', timeout: 30000 });

        await browser.close();
    } catch (e) {
        console.log('Script Error:', e.message);
    }
})();
