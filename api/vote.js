const { handle } = require('../lib/app');
module.exports = (req, res) => handle('vote', req, res);

