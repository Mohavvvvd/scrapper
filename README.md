# 🕷️ Web Page Element Scraper (Playwright)

A powerful Node.js script that uses Playwright to **scrape all interactive elements** from a web page, including:

* Inputs (text, checkbox, radio, textarea)
* Buttons
* Select dropdowns
* Links

It generates **stable, unique CSS selectors** and saves everything into a structured JSON file — perfect for automation, testing, and data extraction.

---

## 🚀 Features

* ✅ Headless browser scraping (Chromium)
* ✅ Smart and unique CSS selector generation
* ✅ XPath fallback for reliability
* ✅ Visibility detection (ignores hidden elements)
* ✅ Extracts labels, placeholders, attributes
* ✅ Outputs clean JSON
* ✅ Works with dynamic pages

---

## 📦 Installation

1. Clone or copy the script into your project

2. Install dependencies:

```bash
npm install playwright
```

3. Install browser binaries:

```bash
npx playwright install
```

---

## 📁 File Structure

```
project/
│
├── script.cjs
└── output.json (generated after run)
```

---

## ▶️ Usage

Run the script with a target URL:

```bash
node script.cjs https://example.com
```

---

## 📄 Output

The script generates a JSON file like:

```
example_com_full_scrape.json
```

### Example Output:

```json
{
  "url": "https://example.com",
  "title": "Example Domain",
  "scrapedAt": "2026-04-29T12:00:00.000Z",
  "counts": {
    "inputs": 2,
    "buttons": 1,
    "selects": 0,
    "links": 5
  },
  "inputs": [...],
  "buttons": [...],
  "selects": [...],
  "links": [...]
}
```

---

## 🧠 How It Works

1. Launches a headless Chromium browser
2. Navigates to the provided URL
3. Extracts DOM elements using `page.evaluate`
4. Generates:

   * Unique CSS selectors
   * XPath fallback
5. Saves structured data into JSON

---

## 🔍 Extracted Data

### Inputs

* type (text, checkbox, radio…)
* label
* name / id
* placeholder
* required / disabled
* selector + xpath

### Buttons

* text content
* type
* selector + xpath

### Selects

* options (text + value)
* multiple / required

### Links

* href
* text
* target

---

## ⚙️ Environment Variables

Optional: specify a custom Chromium path

```bash
export CHROMIUM_PATH=/usr/bin/chromium
```

Windows:

```bash
set CHROMIUM_PATH=C:\path\to\chrome.exe
```

---

## ⚠️ Common Issues

### ❌ Invalid URL

Make sure to pass a valid URL:

```bash
node scrape_all.cjs https://example.com
```

---

### ❌ Timeout Errors

Try changing:

```js
waitUntil: 'domcontentloaded'
```

---

### ❌ Dynamic Content Not Loaded

Increase wait time:

```js
await page.waitForTimeout(3000);
```

---

### ❌ Bot Protection (Cloudflare, etc.)

Some websites block scraping. You may need:

* proxies
* stealth plugins

---

## 💡 Use Cases

* 🔹 Automated UI testing (Playwright / Selenium)
* 🔹 Form auto-fill bots
* 🔹 Reverse engineering web forms
* 🔹 Web crawling / data extraction
* 🔹 Test case generation

---

## 🧩 Example (Automation)

```js
await page.fill('input[name="email"]', 'test@mail.com');
await page.click('button[type="submit"]');
```

---

## 📤 Exported Functions

You can also use it programmatically:

```js
const { scrapeAllElements } = require('./scrape_all');

const data = await scrapeAllElements('https://example.com');
console.log(data);
```

---

## 🛠️ Future Improvements

* Crawl multiple pages
* Auto-generate Playwright tests
* AI-based form filling
* Screenshot + element mapping

---

## 📜 License

MIT

---

## 👨‍💻 Author

Built for developers who want **deep control over web automation and scraping**.
