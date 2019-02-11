// Network engine data.
let network = {};

// Clients list.
network.clients = new Map();

network.clients.broadcast = (obj) => {
    for(let client of Array.from(network.clients).filter(el=>el[1].authenticated).map(el=>el[1])){
        client.send(obj);
    }
}

module.exports = network;