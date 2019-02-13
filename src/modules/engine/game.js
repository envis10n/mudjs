let game = {};

game.classes = new Map();

game.classes.addClass = (key, data) => {
    game.classes.set(key, data);
}

game.classes.getDescriptions = () => {
    return Array.from(game.classes).map(el=>({name: el[0], description: el[1].description || "No description available."}));
}

module.exports = game;