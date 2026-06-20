// Hermes-safe wrapper for webidl-conversions.
// The upstream package reads SharedArrayBuffer at module scope. Install the
// before-main shim first, then load the real package implementation.
require('../early-polyfills');

module.exports = require('webidl-conversions/lib/index.js');
