const { expressjwt: jwt } = require("express-jwt");
const jwksRsa = require('jwks-rsa');
require('dotenv').config()
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;

module.exports.checkJwt = jwt({
    secret: jwksRsa.expressJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`
    }),
  
    // Validate the audience and the issuer.
    issuer: `https://${AUTH0_DOMAIN}/`,
    algorithms: ['RS256']
  });
