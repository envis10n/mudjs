const EventEmitter = require('events');
const Timer = require('../classes/timer');

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
}

timers.nextTick = (cb) => {
    let timer = new Timer(world, "tick", Timer.ONE);
    timers.set(timer.id, timer);
    timer.once('done', (...args) => {
        cb(...args);
        timers.delete(timer.id);
        timer = null;
    });
}

world.timers = timers;

// Network engine data.
let network = {};

// Clients list.
network.clients = new Map();

module.exports.network = network;
module.exports.world = world;