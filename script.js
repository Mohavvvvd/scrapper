const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  try {
    const found = execSync('which chromium', { encoding: 'utf8' }).trim();
    if (found) return found;
  } catch (_) {}
  return undefined;
}

async function scrapeAllElements(url) {
  let browser = null;

  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: findChromium(),
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    const result = await page.evaluate(() => {
      const cssEscape = (s) =>
        (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/([^\w-])/g, '\\$1');

      const isVisible = (el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0'
        );
      };

      const cleanText = (s) =>
        (s || '').replace(/\s+/g, ' ').trim().slice(0, 200) || null;

      const getLabel = (el) => {
        if (el.getAttribute('aria-label')) return cleanText(el.getAttribute('aria-label'));
        const labelledBy = el.getAttribute('aria-labelledby');
        if (labelledBy) {
          const ref = document.getElementById(labelledBy);
          if (ref) return cleanText(ref.textContent);
        }
        if (el.id) {
          const lbl = document.querySelector(`label[for="${el.id}"]`);
          if (lbl) return cleanText(lbl.textContent);
        }
        const wrappingLabel = el.closest('label');
        if (wrappingLabel) return cleanText(wrappingLabel.textContent);
        return null;
      };

      const getXPath = (el) => {
        if (el.id) return `//*[@id="${el.id}"]`;
        const parts = [];
        let node = el;
        while (node && node.nodeType === 1 && node !== document.body) {
          let index = 1;
          let sib = node.previousElementSibling;
          while (sib) {
            if (sib.tagName === node.tagName) index++;
            sib = sib.previousElementSibling;
          }
          parts.unshift(`${node.tagName.toLowerCase()}[${index}]`);
          node = node.parentElement;
        }
        return '/html/body/' + parts.join('/');
      };

      // ----- IMPROVED SELECTOR FUNCTION (unique & stable) -----
      const getBestSelector = (el) => {
        // 1. data-testid family
        const testId = el.getAttribute('data-testid') ||
                       el.getAttribute('data-test-id') ||
                       el.getAttribute('data-test') ||
                       el.getAttribute('data-cy');
        if (testId) {
          const attr = el.hasAttribute('data-testid') ? 'data-testid'
                      : el.hasAttribute('data-test-id') ? 'data-test-id'
                      : el.hasAttribute('data-test') ? 'data-test'
                      : 'data-cy';
          return `[${attr}="${testId}"]`;
        }

        // 2. ID (must be valid CSS identifier)
        if (el.id && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(el.id)) {
          return `#${cssEscape(el.id)}`;
        }

        // 3. Name (only for form elements)
        if (el.name && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(el.name)) {
          const tag = el.tagName.toLowerCase();
          if (tag === 'input' || tag === 'select' || tag === 'textarea' || tag === 'button') {
            const type = el.getAttribute('type');
            const typePart = type && type !== 'text' ? `[type="${type}"]` : '';
            return `${tag}${typePart}[name="${el.name}"]`;
          }
        }

        // 4. Aria-label
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.trim().length > 0) {
          return `${el.tagName.toLowerCase()}[aria-label="${ariaLabel.replace(/"/g, '\\"')}"]`;
        }

        // 5. Build a stable CSS path using tag + first class + nth-of-type
        let pathSegments = [];
        let node = el;
        while (node && node.nodeType === 1 && node !== document.body) {
          let selector = node.tagName.toLowerCase();
          // Add a single meaningful class (ignore dynamic/state classes)
          const classes = Array.from(node.classList).filter(c => !c.match(/^(active|hover|focus|ng-|v-|is-|has-)/i));
          if (classes.length) {
            selector += '.' + classes[0];
          }
          // nth-of-type only needed if there are siblings with same tag
          const siblings = node.parentNode ? Array.from(node.parentNode.children).filter(c => c.tagName === node.tagName) : [];
          if (siblings.length > 1) {
            const index = siblings.indexOf(node) + 1;
            selector += `:nth-of-type(${index})`;
          }
          pathSegments.unshift(selector);
          node = node.parentElement;
        }
        let cssPath = pathSegments.join(' > ');
        // Verify uniqueness on live DOM
        if (document.querySelectorAll(cssPath).length === 1) {
          return cssPath;
        }

        // 6. Ultimate fallback: use a temporary marker attribute (rare)
        const marker = `data-automation-${Date.now()}`;
        el.setAttribute(marker, '');
        const markerSelector = `[${marker}]`;
        el.removeAttribute(marker);
        return markerSelector;
      };
      // -------------------------------------------------------

      const collectInputs = () => {
        const elements = document.querySelectorAll('input, textarea');
        return Array.from(elements).map((el) => {
          const type = el.type || (el.tagName === 'TEXTAREA' ? 'textarea' : 'text');
          const item = {
            tag: el.tagName.toLowerCase(),
            type,
            label: getLabel(el),
            name: el.name || null,
            id: el.id || null,
            placeholder: el.placeholder || null,
            required: !!el.required,
            disabled: !!el.disabled,
            visible: isVisible(el),
            selector: getBestSelector(el),   // improved unique CSS selector
            xpath: getXPath(el),             // kept as fallback reference
          };
          if (['radio', 'checkbox'].includes(type)) {
            item.value = el.value || null;
            item.checked = !!el.checked;
          }
          return item;
        });
      };

      const collectButtons = () => {
        const elements = document.querySelectorAll(
          'button, input[type="button"], input[type="submit"], input[type="reset"], [role="button"]'
        );
        return Array.from(elements).map((el) => ({
          tag: el.tagName.toLowerCase(),
          type: el.type || el.getAttribute('role') || 'button',
          text: cleanText(el.textContent) || cleanText(el.value) || getLabel(el),
          name: el.getAttribute('name') || null,
          id: el.id || null,
          disabled: !!el.disabled,
          visible: isVisible(el),
          selector: getBestSelector(el),
          xpath: getXPath(el),
        }));
      };

      const collectSelects = () => {
        const elements = document.querySelectorAll('select');
        return Array.from(elements).map((el) => ({
          tag: 'select',
          label: getLabel(el),
          name: el.name || null,
          id: el.id || null,
          multiple: !!el.multiple,
          required: !!el.required,
          disabled: !!el.disabled,
          visible: isVisible(el),
          selector: getBestSelector(el),
          xpath: getXPath(el),
          options: Array.from(el.options).map((opt) => ({
            text: cleanText(opt.text),
            value: opt.value,
            selected: !!opt.selected,
          })),
        }));
      };

      const collectLinks = () => {
        const elements = document.querySelectorAll('a[href]');
        return Array.from(elements).map((el) => ({
          tag: 'a',
          text: cleanText(el.textContent),
          href: el.href || null,
          target: el.target || null,
          id: el.id || null,
          visible: isVisible(el),
          selector: getBestSelector(el),
          xpath: getXPath(el),
        }));
      };

      return {
        title: document.title,
        inputs: collectInputs(),
        buttons: collectButtons(),
        selects: collectSelects(),
        links: collectLinks(),
      };
    });

    return {
      url,
      title: result.title,
      scrapedAt: new Date().toISOString(),
      counts: {
        inputs: result.inputs.length,
        buttons: result.buttons.length,
        selects: result.selects.length,
        links: result.links.length,
      },
      inputs: result.inputs,
      buttons: result.buttons,
      selects: result.selects,
      links: result.links,
    };
  } catch (error) {
    throw new Error(`Scraping failed: ${error.message}`);
  } finally {
    if (browser) await browser.close();
  }
}

async function saveToJsonFile(data, filename) {
  const jsonString = JSON.stringify(data, null, 2);
  await fs.writeFile(filename, jsonString, 'utf8');
  console.log(`Data successfully saved to ${filename}`);
}

async function main() {
  const url = process.argv[2];

  if (!url) {
    console.error('Please provide a URL to scrape');
    console.log('Usage: node scrape_all.cjs <url>');
    process.exit(1);
  }

  try {
    new URL(url);
  } catch (error) {
    console.error('Invalid URL format');
    process.exit(1);
  }

  console.log(`Starting comprehensive scrape of: ${url}`);

  try {
    const scrapedData = await scrapeAllElements(url);
    const urlObj = new URL(url);
    const filename = path.join(
      __dirname,
      `${urlObj.hostname.replace(/\./g, '_')}_full_scrape.json`
    );

    await saveToJsonFile(scrapedData, filename);

    console.log('\nScraping Summary:');
    console.log(`   Page title: ${scrapedData.title}`);
    console.log(`   Inputs: ${scrapedData.counts.inputs}`);
    console.log(`   Buttons: ${scrapedData.counts.buttons}`);
    console.log(`   Select dropdowns: ${scrapedData.counts.selects}`);
    console.log(`   Links: ${scrapedData.counts.links}`);

    if (scrapedData.inputs.length) {
      console.log(`\nInputs (first 5):`);
      scrapedData.inputs.slice(0, 5).forEach((inp, i) => {
        console.log(`   ${i + 1}. [${inp.type}] ${inp.label || inp.placeholder || inp.name || '(no label)'} -> ${inp.selector}`);
      });
    }

    if (scrapedData.buttons.length) {
      console.log(`\nButtons (first 5):`);
      scrapedData.buttons.slice(0, 5).forEach((b, i) => {
        console.log(`   ${i + 1}. "${b.text || '(no text)'}" -> ${b.selector}`);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { scrapeAllElements, saveToJsonFile };