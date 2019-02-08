const _p = require('util').promisify;
const fs = require('fs');
const asyncRead = _p(fs.readFile);
const asyncDir = _p(fs.readdir);
const vm = require('vm');
const Path = require('path');
let commands = new Map();

commands.load_command = async (path) => {
    let code = (await asyncRead(path)).toString();
    let command = vm.runInNewContext(code, {
        engine: require('./engine'),
        console,
        require,
        util
    });
    commands.set(command.name, command);
}

commands.load_all = async (root = Path.join(process.cwd(), 'src', 'commands')) => {
    let files = await asyncDir(root);
    for(let file of files){
        let path = Path.join(root, file);
        await commands.load_command(path);
    }
}

module.exports = commands;