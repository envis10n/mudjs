const arangojs = require('arangojs');

let database = new arangojs.Database({
    url: "http://localhost:8529"
});

database.useDatabase(process.env.ARANGO_DB);
database.useBasicAuth(process.env.ARANGO_USER, process.env.ARANGO_PASSWORD);

let collections = JSON.parse(process.env.ARANGO_COLLECTIONS);

let cols = {};

for(let col of collections){
    cols[col] = database.collection(col);
    cols[col].exists().then(b=>{
        if(!b){
            cols[col].create().then(()=>{
                console.log(`Created collection: ${col}`);
            });
        }
    });
    cols[col].find = async(example, opts) => {
        let list = await (await cols[col].byExample(example, opts)).all()
        list.forEach((doc, i)=>{
            doc.update = async () => {
                let d = Object.assign({}, doc);
                delete d.update;
                await cols[col].replace(d._key, d);
            }
        });
        return list;
    }
    cols[col].findOne = async(example) => {
        try {
            let doc = await cols[col].firstExample(example);
            doc.update = async () => {
                let d = Object.assign({}, doc);
                delete d.update;
                await cols[col].replace(d._key, d);
            }
            return doc;
        } catch(e) {
            return null;
        }
    }
}

module.exports = cols;
