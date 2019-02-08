const EventEmitter = require('events');
const Timer = require('../classes/timer');
const path = require('path');

// World engine data.
let world = new EventEmitter();
world.last_tick = Date.now();

// World tick
setInterval(() => {
    world.emit('tick', Date.now()-world.last_tick);
    world.last_tick = Date.now();
}, 1);

let timers = new Map();

timers.after = (delay = 1, cb) => {
    let timer = new Timer(world, "tick", Timer.AFTER, delay);
    timers.set(timer.id, timer);
    timer.once('done', (...args) => {
        cb(...args);
        timers.delete(timer.id);
        timer = null;
    });
    return timer;
}

timers.nextTick = (cb) => {
    let timer = new Timer(world, "tick", Timer.ONE);
    timers.set(timer.id, timer);
    timer.once('done', (...args) => {
        cb(...args);
        timers.delete(timer.id);
        timer = null;
    });
    return timer;
}

world.timers = timers;

// Network engine data.
let network = {};

// Clients list.
network.clients = new Map();

network.clients.broadcast = (obj) => {
    for(let client of Array.from(network.clients).filter(el=>el[1].authenticated).map(el=>el[1])){
        client.send(obj);
    }
}

module.exports.network = network;
module.exports.world = world;
module.exports.db = require('./database');
module.exports.commands = require('./commands');
module.exports.commands.load_all();