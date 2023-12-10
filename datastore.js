const { Datastore, PropertyFilter } = require('@google-cloud/datastore');


module.exports.Datastore = Datastore;
module.exports.PropertyFilter = PropertyFilter;
module.exports.datastore = new Datastore();
module.exports.fromDatastore = function fromDatastore(item){
    item.id = item[Datastore.KEY].id;
    return item;
}
