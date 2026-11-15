const queries = require('../db/queries');

function health(req, res) {
  res.json({
    status: 'ok',
    database: 'connected',
    counts: queries.getHealth()
  });
}

module.exports = { health };
