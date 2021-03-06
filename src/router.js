const _ = require('lodash');
const validate = require('express-validation');
const express = require('express');
const pdf = require('./http/pdf-http');
const config = require('./config');
const logger = require('./util/logger')(__filename);
const { renderQuerySchema, renderBodySchema, sharedQuerySchema } = require('./util/validation');

function createRouter() {
  const router = express.Router();

  if (!_.isEmpty(config.API_TOKENS)) {
    logger.info('x-api-key authentication required');

    router.use('/*', (req, res, next) => {
      const userToken = req.headers['x-api-key'] || req.query['api_key'];
      delete req.query['api_key'];
      if (!_.includes(config.API_TOKENS, userToken)) {
        const err = new Error('Invalid API token in x-api-key header.');
        err.status = 401;
        return next(err);
      }

      return next();
    });
  } else {
    logger.warn('Warning: no authentication required to use the API');
  }

  const getRenderSchema = {
    query: renderQuerySchema,
    options: {
      allowUnknownBody: false,
      allowUnknownQuery: false,
    },
  };
  router.get('/', validate(getRenderSchema), pdf.getRender);

  const postRenderSchema = {
    body: renderBodySchema,
    query: sharedQuerySchema,
    options: {
      allowUnknownBody: false,
      allowUnknownQuery: false,

      // Without this option, text body causes an error
      // https://github.com/AndrewKeig/express-validation/issues/36
      contextRequest: true,
    },
  };
  router.post('/', validate(postRenderSchema), pdf.postRender);

  router.get('/health', function (req, res) {
    res.send('OK')
  })

  router.use('/tmp', express.static(config.TMP_PATH));

  return router;
}

module.exports = createRouter;
