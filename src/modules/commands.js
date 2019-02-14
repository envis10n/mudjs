const _p = require('util').promisify;
const fs = require('fs');
const asyncRead = _p(fs.readFile);
const asyncDir = _p(fs.readdir);
const vm = require('vm');
const Path = require('path');
/**
 * @module commands
 */
let commands_list = new Map();
let commands = {};
let chalk = require('chalk');

/**
 * Add a command.
 * @param {Object} data Command data object.
 * @param {String} data.name Required. Name of the command to add.
 * @param {Array} data.permissions Optional. Array of permissions required to run this command.
 * @param {Array} data.options Optional. Array of options objects.
 * @param {Function} data.handler Required. Function handler used when the command is invoked. Takes 3 parameters: context, args, options
 */
commands.add = (data) => {
    if(typeof data != 'object' || data == null || Object.keys(data).length == 0) throw new TypeError("Command data object must be provided.");
    if(typeof data.name != 'string' || data.name.length == 0) throw new TypeError("Command name must be a valid string.");
    if(typeof data.handler != 'function') throw new TypeError("Command handler must be a valid function.");
    commands_list.set(data.name, data);
}

commands.get_command = (name) => {
    return commands_list.get(name);
}

commands.load_command = async (path) => {
    let code = (await asyncRead(path)).toString();
    let command = vm.runInNewContext(code, {
        engine: require('./engine'),
        console,
        require,
        util,
        chalk
    });
    commands_list.set(command.name, command);
}

commands.load_all = async (root = Path.join(process.cwd(), 'src', 'commands')) => {
    let files = await asyncDir(root);
    for(let file of files){
        let path = Path.join(root, file);
        await commands.load_command(path);
    }
}

module.exports = commands;