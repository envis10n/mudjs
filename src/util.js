const uuidv4 = require('uuid/v4');
const crypto = require('crypto');
const _p = require('util').promisify;

const scrypt = _p(crypto.scrypt);

let util = {};

util.uuid = uuidv4;

util.parse_arguments = (args, options = [])=>{
	var t = [];
	var buffer = [];
	if(typeof args == 'string') args = args.split(' ');
	args.forEach(arg=>{
		if((arg[0] == "'" || arg[0] == '"') && !(arg[arg.length-1] == '"' || arg[arg.length-1] == "'") && buffer.length == 0) {
			buffer.push(arg.substring(1));
		} else if(!(arg[0] == "'" || arg[0] == '"') && (arg[arg.length-1] == '"' || arg[arg.length-1] == "'") && buffer.length != 0){
			buffer.push(arg.substring(0, arg.length-1));
			t.push(buffer.join(' '));
			buffer = [];
		} else if((arg[0] == "'" || arg[0] == '"') && (arg[arg.length-1] == '"' || arg[arg.length-1] == "'")) {
			t.push(arg.substring(1, arg.length-1));
		} else if(buffer.length != 0){
			buffer.push(arg);
		} else {
			t.push(arg);
		}
    });
	args = t;
	var opts = {};
    if(options.length && options.length > 0){
        options.forEach(opt=>{
			var i = -1;
			t.some((el, i2)=>{
				if(opt.alias ? (el == `-${opt.alias}` || el == `--${opt.name}` || el.substring(0, opt.alias.length+1) == `-${opt.alias}` || el.substring(0, opt.name.length+2) == `--${opt.name}`) : (el == `--${opt.name}` || el.substring(0, opt.name.length+2) == `--${opt.name}`)) {
					i = i2;
					return true;
				}
			});
            if(i != -1){
                if(opt.type == String || opt.type.toLowerCase() == "string"){
                    var e = t[i];
                    if(e.split('=').length == 2){
                        t.splice(i, 1);
                        e = e.split('=')[1];
                        var rx1 = new RegExp(/"(.*)"|'(.*)'/);
                        if(rx1.test(e)){
                            var m = rx1.exec(e);
                            if(m[1] != undefined) e = m[1];
                            else e = m[2];
                        }
                    } else {
                        e = t[i+1];
                        t.splice(i, 2);
                    }
                    opts[opt.name] = e;
                } else if (opt.type == Boolean || opt.type.toLowerCase() == "boolean") {
					t.splice(i, 1);
                    opts[opt.name] = true;
                } else if (opt.type == Number || opt.type.toLowerCase() == "number") {
					var e = t[i];
                    if(e.split('=').length == 2){
                        t.splice(i, 1);
                        e = e.split('=')[1];
                    } else {
                        e = t[i+1];
                        t.splice(i, 2);
					}
					if(!isNaN(e)) opts[opt.name] = Number(e);
					else opts[opt.name] = null;
				} else {
                    t.splice(i, 1); // remove option since it is defined, but not valid.
                }
            } else {
                if(opt.type == String || opt.type.toLowerCase() == "string") opts[opt.name] = null;
                else if(opt.type == Boolean || opt.type.toLowerCase() == "boolean") opts[opt.name] = false;
                else if(opt.type == Number || opt.type.toLowerCase() == "number") opts[opt.name] = null;
            }
		});
    }
    var end = false;
    while (!end) {
        var i = t.findIndex(el=>el.substring(0, 2) == '--' || el[0] == '-');
        if(i != -1) {
            var e = t[i];
            e = e.substring(0, 2) == '--' ? e.substring(2) : e.substring(1);
            if(e.split('=').length == 2){
                t.splice(i, 1);
                var name = e.split('=')[0];
				e = e.split('=')[1];
                var rx1 = new RegExp(/"(.*)"|'(.*)'/);
				if(rx1.test(e)){
                    var m = rx1.exec(e);
                    if(m[1] != undefined) e = m[1];
                    else e = m[2];
				}
                if(opts[name] == undefined || opts[name] == null) opts[name] = e;
            } else {
                var name = e;
                e = t[i+1];
                t.splice(i, 2);
                if(opts[name] == undefined || opts[name] == null) opts[name] = e;
            }
        } else {
            end = true;
        }
    }
    return {args: t, flags: opts};
};

util.crypto = {};

util.crypto.hash_pass = async (password) => {
    let salt = crypto.randomBytes(16).toString('base64');
    let hash = (await scrypt(password, salt, 64)).toString('base64');
    return {hash, salt};
}

util.crypto.scrypt_compare = async (password, salt, hash) => {
    let h = (await scrypt(password, salt, 64)).toString('base64');
    return h == hash;
}

global.util = util;