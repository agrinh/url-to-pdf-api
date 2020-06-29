const _ = require('lodash');
const ex = require('../util/express');
const fetch = require('node-fetch');
const logger = require('../util/logger')(__filename);
const pdfCore = require('../core/pdf-core');


/* Get URL to existing PDF for the given PDF
 *
 * Relevant on pages like ArXiv or when the URL leads to a PDF.
 */
async function getExistingPdfUrl(raw_url) {
  // PDF as indicated by file extension
  const isPDFPattern = /\.pdf$/;
  if (raw_url.match(isPDFPattern)) {
    logger.info('Recognized PDF extension of: ' + raw_url);
    return raw_url;
  }
  const url = new URL(raw_url);
  switch (url.hostname) {
    case 'arxiv.org':  // Find ArXiv PDFs
      const arxivIdPattern = /^\/(abs|pdf)\/(\d+\.\d+)/;
      const arxivId = url.pathname.match(arxivIdPattern);
      if (arxivId != null) {
        logger.info('Found ArXiv ID: ' + arxivId + ' in ' + raw_url);
        return 'https://arxiv.org/pdf/' + arxivId[2];
      }
      break;
    case 'openreview.net':  // Find OpenReview PDFs
      if (url.pathname == '/forum' || url.pathname == '/pdf') {
        url.pathname = '/pdf';
        logger.info('Found OpenReview: ' + url.search.toString() + ' in ' + raw_url);
        return url.toString();
      }
      break;
  }

  // Perform a HEAD request to see if the content-type indicates a PDF
  const headRequest = await fetch(raw_url, {method: 'HEAD'});
  const contentType = headRequest.headers.get('content-type');
  if (contentType.toLowerCase().endsWith('pdf')) {
    logger.info('Recognized PDF content-type: ' + contentType + ' in ' + raw_url);
    return raw_url;
  }
  return null;
}

const getRender = ex.createRoute(async (req, res) => {
  const opts = getOptsFromQuery(req.query);
  const existingPdfUrl = await getExistingPdfUrl(opts.url);
  if (existingPdfUrl != null) {
    return res.redirect(existingPdfUrl);
  }

  return pdfCore.render(opts)
    .then((data) => {
      if (opts.attachmentName) {
        res.attachment(opts.attachmentName);
      }
      res.set('content-type', 'application/pdf');
      res.send(data);
    });
});

const postRender = ex.createRoute(async (req, res) => {
  const isBodyJson = req.headers['content-type'] === 'application/json';
  if (isBodyJson) {
    const hasContent = _.isString(_.get(req.body, 'url')) || _.isString(_.get(req.body, 'html'));
    if (!hasContent) {
      ex.throwStatus(400, 'Body must contain url or html');
    }
  } else if (_.isString(req.query.url)) {
    ex.throwStatus(400, 'url query parameter is not allowed when body is HTML');
  }

  let opts;
  if (isBodyJson) {
    opts = _.cloneDeep(req.body);
  } else {
    opts = getOptsFromQuery(req.query);
    opts.html = req.body;
  }

  const existingPdfUrl = await getExistingPdfUrl(opts.url);
  if (existingPdfUrl != null) {
    return res.redirect(existingPdfUrl);
  }

  return pdfCore.render(opts)
    .then((data) => {
      if (opts.attachmentName) {
        res.attachment(opts.attachmentName);
      }
      res.set('content-type', 'application/pdf');
      res.send(data);
    });
});

function getOptsFromQuery(query) {
  const opts = {
    url: query.url,
    attachmentName: query.attachmentName,
    scrollPage: query.scrollPage,
    emulateScreenMedia: query.emulateScreenMedia,
    ignoreHttpsErrors: query.ignoreHttpsErrors,
    waitFor: query.waitFor,
    viewport: {
      width: query['viewport.width'],
      height: query['viewport.height'],
      deviceScaleFactor: query['viewport.deviceScaleFactor'],
      isMobile: query['viewport.isMobile'],
      hasTouch: query['viewport.hasTouch'],
      isLandscape: query['viewport.isLandscape'],
    },
    goto: {
      timeout: query['goto.timeout'],
      waitUntil: query['goto.waitUntil'],
      networkIdleInflight: query['goto.networkIdleInflight'],
      networkIdleTimeout: query['goto.networkIdleTimeout'],
    },
    pdf: {
      scale: query['pdf.scale'],
      displayHeaderFooter: query['pdf.displayHeaderFooter'],
      landscape: query['pdf.landscape'],
      pageRanges: query['pdf.pageRanges'],
      format: query['pdf.format'],
      width: query['pdf.width'],
      height: query['pdf.height'],
      margin: {
        top: query['pdf.margin.top'],
        right: query['pdf.margin.right'],
        bottom: query['pdf.margin.bottom'],
        left: query['pdf.margin.left'],
      },
      printBackground: query['pdf.printBackground'],
    },
  };
  return opts;
}

module.exports = {
  getRender,
  postRender,
};
