const express = require('express');
const bodyParser = require('body-parser');


const router = express.Router();

const ds = require('./datastore');
const datastore = ds.datastore;

const USER = "User"

router.use(bodyParser.json());


/* ------------- Begin User Model Functions ------------- */


// Get all users
function get_users() {
    const q = datastore.createQuery(USER);
    return datastore.runQuery(q).then((entities) => {
        // Use Array.map to call the function fromDatastore. This function
        // adds id attribute to every element in the array at element 0 of
        // the variable entities
        return entities[0].map(ds.fromDatastore);
    });
}

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

// Get all users with pagination
router.get('/', function (req, res) {
    get_users(req)
        .then((users) => {
            res.status(200).json(users);
        });
});

// Return 405 status code for DELETE on root URL
router.delete('/', function (req, res){
    res.set('Accept', 'GET');
    res.status(405).json({"Error": "Not Acceptable"});
});

// Return 405 status code for PUT on root URL
router.put('/', function (req, res){
    res.set('Accept', 'GET');
    res.status(405).json({"Error": "Not Acceptable"});
});

// Return 405 status code for PATCH on root URL
router.patch('/', function (req, res){
    res.set('Accept', 'GET');
    res.status(405).json({"Error": "Not Acceptable"});
});

/* ------------- End Controller Functions ------------- */

module.exports = router;