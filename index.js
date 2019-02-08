// Global utilities
require('./src/util');

// Network module
let network = require('./src/modules/network');

// Load server
(async () => {
    // Load engine data so it gets cached.
    let engine = require('./src/modules/engine');

    // Load grapevine.
    let grapevine = require('./src/modules/grapevine');

    // Attach grapevine to engine.
    engine.grapevine = grapevine;

    // Load network layer.
    let wss = await network.load();
    if(process.env.GV_ENABLED == "true") {
        console.log("Connecting to Grapevine...");
        engine.grapevine.connect();
    }
    else console.log("Grapevine disabled.");
})();