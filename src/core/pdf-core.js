const puppeteer = require('puppeteer');
const BPromise = require('bluebird');
const _ = require('lodash');

async function render(_opts = {}) {
  const opts = _.merge({
    scrollPage: false,
    emulateMedia: false,
    viewport: {
      width: 1600,
      height: 1200,
    },
    goto: {
      waitUntil: 'networkidle',
      networkIdleTimeout: 2000,
    },
    pdf: {
      format: 'A4',
      printBackground: true,
    }
  }, _opts);
  console.log(opts)
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport(opts.viewport);
  if (opts.emulateMedia) {
    await page.emulateMedia('screen');
  }

  if (_.isNumber(opts.waitFor) || _.isString(opts.waitFor)) {
    await page.waitFor(opts.waitFor);
  }

  await page.goto(opts.url, opts.goto);

  if (opts.scrollPage) {
    await scrollPage(page);
  }

  const data = await page.pdf(opts.pdf);
  await browser.close();

  return data;
}

async function scrollPage(page) {
  // Scroll to page end to trigger "appear" when in viewport effects
  return await page.evaluate(() => {
    const scrollInterval = 200;
    const scrollStep = window.innerHeight - 400;
    const bottomThreshold = 400;

    function bottomPos() {
      return window.pageYOffset + window.innerHeight;
    }

    return new Promise((resolve, reject) => {
      function scrollDown() {
        window.scrollBy(0, scrollStep);

        if (document.body.scrollHeight - bottomPos() < bottomThreshold) {
          window.scrollTo(0, 0);
          setTimeout(resolve, 500);
          return;
        }

        setTimeout(scrollDown, scrollInterval);
      }

      setTimeout(reject, 30000);
      scrollDown();
    });
  });
}

module.exports = {
  render,
};