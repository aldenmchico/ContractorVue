const express = require('express');
const bodyParser = require('body-parser');

const router = express.Router();

const ds = require('./datastore');
const { PropertyFilter } = require('@google-cloud/datastore');
const datastore = ds.datastore;
const jwtPackage = require('./jwt')

const EMPLOYEE = "Employee";
const OFFICE = "Office";
const QLIMIT = 5;

// Global RegEx variables
var namePattern = /^[a-zA-Z\s\-']{2,40}$/;

router.use(bodyParser.json());


/* ------------- Begin Office Model Functions ------------- */

// Create an employee
async function post_employee(req){
    try {
        // Return "invalid attribute" if an extraneous attribute was found in input
        const keys = Object.keys(req.body);
        for (let i = 0; i < keys.length; i++) {
            if (keys[i] === 'first_name' ||  keys[i] == 'last_name' || keys[i] === 'pay_rate') continue;
            return "invalid attribute";
        }

        // Return "insufficient attributes" if not all the fields are included in request body
        if (req.body.first_name === null || req.body.first_name === undefined ||
            req.body.last_name === null || req.body.last_name === undefined ||
            req.body.pay_rate === null || req.body.pay_rate === undefined ) return "insufficient attributes";
        // Return "invalid first name" if the first_name attribute contains non alphanumeric characters and is not between 2-40 characters in length
        if (!namePattern.test(req.body.first_name)) return "invalid first name";
        // Return "invalid last name" if the first_name attribute contains non alphanumeric characters and is not between 2-40 characters in length
        if (!namePattern.test(req.body.last_name)) return "invalid last name";
        // Return "invalid pay rate" if pay rate entered is not a positive number
        if (isNaN(Number(req.body.pay_rate))) return "invalid pay rate";
        else if ((Number(req.body.pay_rate) < 0)) return "invalid pay rate";

        // Save employee with initial data from POST request
        var key = datastore.key(EMPLOYEE);
        const new_employee = { "first_name": req.body.first_name, "last_name": req.body.last_name, "pay_rate": req.body.pay_rate.toFixed(2), 
                                "employer": null,  "owner": req.auth.sub };
        let s = await datastore.save({"key":key, "data":new_employee});
        
        // Retrieve the employee using the generated key and add id / self entities
        let employee_object = await datastore.get(key);
        if (employee_object[0] !== undefined || employee_object[0] !== null) {
            employee_object.map(ds.fromDatastore);
            new_employee.id = employee_object[0].id;
            new_employee.self = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + employee_object[0].id;
        }
        s = await datastore.save({"key":key, "data":new_employee});
        employee_object = await datastore.get(key);
        
        // Return the employee object in the POST request
        return employee_object;
    } catch {
        return "failed post"
    }
}

// Get employee using ID
async function get_employee(id) {
    try {
        const key = datastore.key([EMPLOYEE, parseInt(id, 10)]);
        let r = datastore.get(key);
        return r;
    } catch {
        return "not found";
    }
}

// Get employees with next pagination implemented
function get_employees(req){
    
    // Create a query for QLIMIT number of employees
    var q = datastore.createQuery(EMPLOYEE).filter(new PropertyFilter('owner', '=', req.auth.sub)).limit(QLIMIT);
    const results = {};

    // If the URL includes a cursor, set start point of query to the cursor location
    if(Object.keys(req.query).includes("cursor")){ 
        let decode_cursor = decodeURIComponent(req.query.cursor);
        q = q.start(decode_cursor);
    }

    // Return the results set with items from the query and a next cursor
	return datastore.runQuery(q).then( (entities) => {
            results.employees = entities[0].map(ds.fromDatastore);
            if(entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS ){
                let encode_cursor = encodeURIComponent(entities[1].endCursor);
                results.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + encode_cursor;
                results.cursor = encode_cursor
            }
			return results;  
		});
}

// Edit all the fields for an existing employee
async function put_employee(req) {
    try {
        // Return "not found" if employee does not exist. Return "forbidden" if the user is not authorized to edit the data.
        const key = datastore.key([EMPLOYEE, parseInt(req.params.id, 10)]);
        let employee = await datastore.get(key);
        if (employee[0] === undefined || employee[0] === null) return "not found";
        else if (employee[0].owner && employee[0].owner !== req.auth.sub) return "forbidden";

        // Return "invalid attribute" if an extraneous attribute was found in input
        const keys = Object.keys(req.body);
        for (let i = 0; i < keys.length; i++) {
            if (keys[i] === 'first_name' ||  keys[i] == 'last_name' || keys[i] === 'pay_rate') continue;
            return "invalid attribute";
        }

        // Return "insufficient attributes" if not all the fields are included in request body
        if (req.body.first_name === null || req.body.first_name === undefined ||
            req.body.last_name === null || req.body.last_name === undefined ||
            req.body.pay_rate === null || req.body.pay_rate === undefined) return "insufficient attributes";
        // Return "invalid first name" if the first name attribute contains non alphanumeric characters and is not between 2-40 characters in length
        if (!namePattern.test(req.body.first_name)) return "invalid first name";
        // Return "invalid last name" if the first_name attribute contains non alphanumeric characters and is not between 2-40 characters in length
        if (!namePattern.test(req.body.last_name)) return "invalid last name";
        // Return "invalid pay rate" if pay rate entered is not a positive number
        if (isNaN(Number(req.body.pay_rate))) return "invalid pay rate";
        else if ((Number(req.body.pay_rate) < 0)) return "invalid pay rate";

        // Update the employee if it exists
        const updated_employee = { "first_name": req.body.first_name, "last_name": req.body.last_name, "pay_rate": req.body.pay_rate.toFixed(2),
                                "id": employee[0].id, "self": employee[0].self, "owner": employee[0].owner, "employer": employee[0].employer };
        const s = await datastore.save({ "key": key, "data": updated_employee });

        // Return the updated employee object
        return datastore.get(key);
    } catch {
        return "failed put"
    }
}


// Edit one or many of the fields for an existing employee
async function patch_employee(req) {
    try {
        // Return "not found" if employee does not exist.
        const key = datastore.key([EMPLOYEE, parseInt(req.params.id, 10)]);
        let employee = await datastore.get(key);
        if (employee[0] === undefined || employee[0] === null) return "not found";
        else if (employee[0].owner && employee[0].owner !== req.auth.sub) return "forbidden";

        // Return "invalid attribute" if an extraneous attribute was found in input
        const keys = Object.keys(req.body);
        for (let i = 0; i < keys.length; i++) {
            if (keys[i] === 'first_name' ||  keys[i] == 'last_name' || keys[i] === 'pay_rate') continue;
            return "invalid attribute";
        }

        // Update the employee with parameters defined in request body
        let updated_employee = {}
        updated_employee.id = employee[0].id;
        updated_employee.self = employee[0].self;
        updated_employee.employer = employee[0].employer;
        updated_employee.owner = employee[0].owner;

        // Update first_name attribute if it's included in the request body.
        if (req.body.first_name === null || req.body.first_name === undefined) updated_employee.first_name = employee[0].first_name;
        else {
            // Return "invalid first name" if the first name attribute contains non alphanumeric characters and is not between 2-40 characters in length
            if (!namePattern.test(req.body.first_name)) return "invalid first name";
            else updated_employee.first_name = req.body.first_name;
        }

        // Update last_name attribute if it's included in the request body.
        if (req.body.last_name === null || req.body.last_name === undefined) updated_employee.last_name = employee[0].last_name;
        else {
            // Return "invalid last name" if the last name attribute is not in the US State Abbreviations array
            if (!namePattern.test(req.body.last_name)) return "invalid last name";
            else updated_employee.last_name = req.body.last_name;
        }

        // Update pay rate attribute if it's included in the request body.
        if (req.body.pay_rate === null || req.body.pay_rate === undefined) updated_employee.pay_rate = employee[0].pay_rate;
        else {
            // Return "invalid pay rate" if pay rate entered is not a positive number
            if (isNaN(Number(req.body.pay_rate))) return "invalid pay rate";
            else if ((Number(req.body.pay_rate) < 0)) return "invalid pay rate";
            else updated_employee.pay_rate = req.body.pay_rate.toFixed(2);
        }
    
        // Update the employee if it exists
        const s = await datastore.save({ "key": key, "data": updated_employee });
        
        // Return the updated employee object
        return datastore.get(key);
    } catch {
        return "failed patch";
    }
}

// Delete employee from datastore
async function delete_employee(req){
    try {
        // Check if the employee exists. Return "not found" if true.
        const e_key = datastore.key([EMPLOYEE, parseInt(req.params.id,10)]);
        let employee = await datastore.get(e_key);
        if (employee[0] === undefined || employee[0] === null) return "not found";
        else if (employee[0].owner && employee[0].owner !== req.auth.sub) return "forbidden";
        
        // Get the office associated with the employee
        if (employee[0].employer !== null) {
            // Retrieve office from datastore
            let o_id = employee[0].employer.id
            let o_key = datastore.key([OFFICE, parseInt(o_id,10)]);
            let office = await datastore.get(o_key);
            // Remove the employee from the office
            for (let i = 0; i < office[0].employees.length; i++) {
                if (office[0].employees[i].id === req.params.id) delete(office[0].employees[i]);
            }
            // Remove the empty item from delete operation
            var filtered_employees = office[0].employees.filter(x => {
                return x != null;
            });
            office[0].employees = filtered_employees;
            // Save the office with employee removed
            let s = await datastore.save({"key":o_key, "data":office[0]});
        }
        
        // Delete the employee if the employee exists
        return datastore.delete(e_key);
    } catch {
        return "not found";
    }
}

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

// Check for a valid token in request header
router.post("/", jwtPackage.checkJwt, (err, req, res, next) => {
    if (err.status === 401) res.status(401).json({"Error": "Invalid token..."});
    else {
        next();
    }
});
// Create an employee
router.post('/', function (req, res) {
    if (req.get('content-type') !== 'application/json') res.status(406).json({"Error": 'Server only accepts application/json data.'});
    else {
            post_employee(req)
            .then(employee => {
                res.set("Content", "application/json");
                if (employee === "invalid attribute") res.status(400).json({"Error": "The request object contains an invalid attribute"});
                else if (employee === "insufficient attributes") res.status(400).json({"Error": "The request object is missing at least one of the required attributes"});
                else if (employee === "invalid first name") res.status(400).json({"Error": "The request object's first name attribute is not valid"});
                else if (employee === "invalid last name") res.status(400).json({"Error": "The request object's last name attribute is not valid"});
                else if (employee === "invalid pay rate") res.status(400).json({"Error": "The request object's pay rate attribute is not valid"});
                else if (employee === "failed post") res.status(400).json({"Error": "Failed to create asset"});
                else {
                    res.location(req.protocol + "://" + req.get('host') + req.baseUrl + "/" + employee[0].id); 
                    res.status(201).json(employee[0]);
                }
            });
    }
});

// Check for a valid token in request header
router.get("/", jwtPackage.checkJwt, (err, req, res, next) => {
    if (err.status === 401) res.status(401).json({"Error": "Invalid token..."});
    else {
        next();
    }
});
// Get all employees with pagination
router.get('/', function (req, res) {
    get_employees(req)
        .then((employees) => {
            res.status(200).json(employees);
        });
});

// Check for a valid token in request header
router.get("/:id", jwtPackage.checkJwt, (err, req, res, next) => {
    if (err.status === 401) res.status(401).json({"Error": "Invalid token..."});
    else if (err.status >= 400) res.status(err.status).send("Bad Request");
    else {
        next();
    }
});
// Get an employee using its ID
router.get('/:id', function (req, res) {
    get_employee(req.params.id)
        .then(employee => {
            if (req.get('content-type') !== 'application/json') res.status(406).json({"Error": 'Server only accepts application/json data.'});
            else {
                if (employee[0] === undefined || employee[0] === null || employee === "not found") res.status(404).json({ 'Error': 'No employee with this employee_id exists' });
                else if (employee[0].owner && employee[0].owner !== req.auth.sub) res.status(403).json({"Error": "Forbidden"});
                else {
                    // Return the 0th element which is the employee with this id
                    res.status(200).json(employee[0]);
                }
            }
        });
});

// Check for a valid token in request header
router.put("/:id", jwtPackage.checkJwt, (err, req, res, next) => {
    if (err.status === 401) res.status(401).json({"Error": "Invalid token..."});
    else if (err.status === 403) res.status(403).json({"Error": "Forbidden"});
    else if (err.status >= 400) res.status(err.status).send("Bad Request");
    else {
        next();
    }
});
// Edit all the fields for an existing employee
router.put('/:id', function (req, res) {
    if (req.get('content-type') !== 'application/json') res.status(406).json({"Error": 'Server only accepts application/json data.'});
    else {
        put_employee(req).then( (employee) => {
            res.set("Content", "application/json");
            if (employee === "not found") res.status(404).json({ 'Error': 'No employee with this employee_id exists' });
            else if (employee === "forbidden") res.status(403).json({"Error": "Forbidden"});
            else if (employee === "invalid attribute") res.status(400).json({"Error": "The request object contains an invalid attribute"});
            else if (employee === "insufficient attributes") res.status(400).json({"Error": "The request object is missing at least one of the required attributes"});
            else if (employee === "invalid first name") res.status(400).json({"Error": "The request object's first name attribute is not valid"});
            else if (employee === "invalid last name") res.status(400).json({"Error": "The request object's last name attribute is not valid"});
            else if (employee === "invalid pay rate") res.status(400).json({"Error": "The request object's pay rate attribute is not valid"});
            else if (employee === "failed put") res.status(400).json({"Error": "Failed to edit asset"});
            else {
                res.location(req.protocol + "://" + req.get('host') + req.baseUrl + "/" + employee[0].id); 
                res.status(303).json(employee[0]);
            }
        });
    }
});

// Check for a valid token in request header
router.patch("/:id", jwtPackage.checkJwt, (err, req, res, next) => {
    if (err.status === 401) res.status(401).json({"Error": "Invalid token..."});
    else if (err.status >= 400) res.status(err.status).send("Bad Request");
    else {
        next();
    }
});
// Edit one or many of the fields for an existing employee
router.patch('/:id', function (req, res) {
    if (req.get('content-type') !== 'application/json') res.status(406).json({"Error": 'Server only accepts application/json data.'});
    else {
        patch_employee(req).then( (employee) => {
            res.set("Content", "application/json");
            if (employee === "not found") res.status(404).json({ 'Error': 'No employee with this employee_id exists' });
            else if (employee === "forbidden") res.status(403).json({"Error": "Forbidden"});
            else if (employee === "invalid attribute") res.status(400).json({"Error": "The request object contains an invalid attribute"});
            else if (employee === "insufficient attributes") res.status(400).json({"Error": "The request object is missing at least one of the required attributes"});
            else if (employee === "invalid first name") res.status(400).json({"Error": "The request object's first name attribute is not valid"});
            else if (employee === "invalid last name") res.status(400).json({"Error": "The request object's last name attribute is not valid"});
            else if (employee === "invalid pay rate") res.status(400).json({"Error": "The request object's pay rate attribute is not valid"});
            else if (employee === "failed patch") res.status(400).json({"Error": "Failed to edit asset"});
            else res.status(200).json(employee[0]);
        });
    }
});

// Check for a valid token in request header
router.delete("/:id", jwtPackage.checkJwt, (err, req, res, next) => {
    if (err.status === 401) res.status(401).json({"Error": "Invalid token..."});
    else if (err.status >= 400) res.status(err.status).send("Bad Request");
    else {
        next();
    }
});
// Delete a employee
router.delete('/:id', function(req, res){
    delete_employee(req).then( (result) => {
        if (result === "not found") res.status(404).json({ 'Error': 'No employee with this employee_id exists' });
        else if (result === "forbidden") res.status(403).json({"Error": "Forbidden"});
        else res.status(204).end();
    }
    );
});
// Return 405 status code for DELETE on root URL
router.delete('/', function (req, res){
    res.set('Accept', 'GET, POST');
    res.status(405).json({"Error": "Not Acceptable"});
});

// Return 405 status code for PUT on root URL
router.put('/', function (req, res){
    res.set('Accept', 'GET, POST');
    res.status(405).json({"Error": "Not Acceptable"});
});

// Return 405 status code for PATCH on root URL
router.patch('/', function (req, res){
    res.set('Accept', 'GET, POST');
    res.status(405).json({"Error": "Not Acceptable"});
});

/* ------------- End Controller Functions ------------- */

module.exports = router;