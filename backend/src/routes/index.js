/** API routing composition. Feature routers own validation and authorization. */
const express = require('express');
const router = express.Router();
const routeRegistry = require('./routeRegistry');

for (const { path, router: featureRouter } of routeRegistry) {
  router.use(path, featureRouter);
}

module.exports = router;
