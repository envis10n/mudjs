const _p = require('util').promisify;
const fs = require('fs');
const asyncRead = _p(fs.readFile);
const vm = require('vm');
let commands = new Map();

// TODO: Write command loading logic.