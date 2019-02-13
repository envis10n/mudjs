const fs = require('fs');
const _p = require('util').promisify;
const readFile = _p(fs.readFile);
const readdir = _p(fs.readdir);
const stat = _p(fs.stat);
const Path = require('path');
const vm = require('vm');
const EventEmitter = require('events');

async function get_dirs(path){
    path = Path.join(process.cwd(), path);
    let files = await readdir(path);
    let dirs = [];
    for(let file of files){
        let s = await stat(Path.join(path, file));
        if(s.isDirectory()){
            dirs.push(Path.join(path, file));
        }
    }
    files = null;
    return dirs;
}

let engine = require('./engine');

let plugins = new Map();

plugins.load = async function(){
    let dirs = await get_dirs('plugins');
    for(let dir of dirs){
        try {
            let meta = (await readFile(Path.join(dir, "plugin.json"))).toString();
            let plugin = new EventEmitter();
            plugin.meta = JSON.parse(meta);
            Object.freeze(plugin.meta);
            if(plugin.meta.name && plugin.meta.version){
                plugins.set(plugin.meta.name, plugin);
                let code = (await readFile(Path.join(dir, "plugin.js"))).toString();
                vm.runInNewContext(code, Object.assign(global, {engine, plugin, console}));
                console.log(`[PLUGINS] Loaded plugin: ${plugin.meta.name} v${plugin.meta.version}`);
            } else {
                throw new Error(`Invalid plugin.json: ${dir}`);
            }
        } catch(e) {
            console.log(`[PLUGINS][ERROR]: ${e.message}`);
        }
    }
    console.log(`[PLUGINS] Loaded ${plugins.size} plugin(s).`);
}

module.exports = plugins;
