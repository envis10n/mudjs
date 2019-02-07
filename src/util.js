const uuidv4 = require('uuid/v4');

let util = {};

util.uuid = uuidv4;

global.util = util;