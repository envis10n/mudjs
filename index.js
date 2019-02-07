// Global utilities
require('./src/util');

// Network module
let network = require('./src/modules/network');

// Load server
(async () => {
    // Load engine data so it gets cached.
    let engine = require('./src/modules/engine');

    // Load network layer.
    let wss = await network.load();
})();