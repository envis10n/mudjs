const EventEmitter = require('events');

class Timer extends EventEmitter{
    constructor(emitter, event, type = Timer.ONE, delay = 1) {
        super();
        if(!(emitter instanceof EventEmitter)) throw new TypeError("Emitter must be valid.");
        if(!event || typeof event != "string") throw new TypeError("Event must be a valid event name.");
        this.id = util.uuid();
        this.delay = delay;
        this.event = event;
        this.emitter = emitter;
        this.end = Date.now()+delay;
        const self = this;
        switch(type) {
            case Timer.AFTER:
                function loop(){
                    self.emitter.once(event, (...args) => {
                        if (Date.now() >= self.end) {
                            self.emit('done', ...args);
                        } else {
                            loop();
                        }
                    });
                }
                loop();
            break;
            case Timer.ONE:
                self.emitter.once(event, (...args) => {
                    self.emit('done', ...args);
                });
            break;
        }
    }
}

// Type enum
Timer.AFTER = 0;
Timer.ONE = 1;

module.exports = Timer;