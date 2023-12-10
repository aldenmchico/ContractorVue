// ------------- Back-end API ----------------------------- //

const express = require('express');
const app = express();

app.use('/', require('./index'));  // Used for backend API
app.enable('trust proxy'); // Enables https protocol


// ------------- Front-end account creation -------------- //

// Import modules
const axios = require('axios');
require('dotenv').config()

// Datastore imports
const ds = require('./datastore');
const datastore = ds.datastore;
const USER = "User";

// Express requirements
app.use(express.json())
app.use(express.urlencoded({
    extended: true
}));
app.use(express.static('public'));
app.enable('trust proxy'); // Enables https protocol

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const TOKEN = process.env.TOKEN;
const CONNECTION = process.env.CONNECTION;
const authToken = 'Bearer ' + TOKEN;

// Create a user and display the JWT on the web client
app.post('/create', async (req, res) => {
  
  let postData = {
    "email": `${req.body.email}`, //
    "user_metadata": {},
    "blocked": false,
    "email_verified": true,
    "app_metadata": {},
    "connection": CONNECTION,
    "password": `${req.body.password}`, //
    "verify_email": false
  }
  try {

    // Create an account in Auth0 
    let response = await axios.post('https://' + AUTH0_DOMAIN + '/api/v2/users', postData, 
    {headers: {'Content-Type': 'application/json', 'Authorization': `${authToken}`}});
    postData = {
      "username": `${req.body.email}`,
      "password": `${req.body.password}`
    }

    // Save user account info in datastore
    var key = datastore.key(USER);
    const new_user = {"username": req.body.email, "password": req.body.password, "sub":response.data.user_id}
    await datastore.save({"key":key, "data":new_user});

    // Retrieve the user using the generated key and add id / self entities
    let user_object = await datastore.get(key);
    if (user_object[0] !== undefined || user_object[0] !== null) {
        user_object.map(ds.fromDatastore);
        new_user.id = user_object[0].id;
        new_user.self = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + user_object[0].id;
    }
    await datastore.save({"key":key, "data":new_user});

    try {
      // Generate an ID token that can be used for authorization
      const URL = process.env.GOOGLE_DOMAIN + '/jwt'
      response = await axios.post(URL, postData, {headers: {'Content-Type': 'application/json'}})
      res.status(200).send(`
      <li><b>User's Datastore ID</b>: ${new_user.id} </li>
      <li><b>User's Auth0 Sub</b>: ${new_user.sub} </li>
      <li>Access Token: ${response.data.access_token}</li>
      <li><b>ID Token</b>: ${response.data.id_token}</li>
      <li>Scope: ${response.data.scope}</li>
      <li>Expires In: ${response.data.expires_in}</li>
      <li>Token Type: ${response.data.token_type}</li>
      <a href='/'> Return to Create Account Page </a>
      `)
      
    } catch {
      res.status(401).send(
        `<p>Error creating authorization token</p>
        <a href='/'> Return to Create Account Page </a>`
      )
    }
  } catch {
    res.status(401).send(
      `<p>Error processing account creation</p>
      <a href='/'> Return to Create Account Page </a>`
    )
  }
})


const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

// Log in with the supplied credentials
app.post('/login', async (req, res) => {
  const username = req.body.email;
  const password = req.body.password;
  let url = `https://${AUTH0_DOMAIN}/oauth/token`
  let postData = { 
    grant_type: 'password',
    username: username,
    password: password,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET }
  let headers = { 'content-type': 'application/json' }
  try {
    let response = await axios.post(url, postData, headers)
    res.status(200).send(`
      <li>Access Token: ${response.data.access_token}</li>
      <li>ID Token: ${response.data.id_token}</li>
      <li>Scope: ${response.data.scope}</li>
      <li>Expires In: ${response.data.expires_in}</li>
      <li>Token Type: ${response.data.token_type}</li>
      <a href='./login.html'> Return to Account Login Page </a>
    `)
  } catch {
    res.status(401).send(`<p>Error logging into account...</p>
      <a href='./login.html'> Return to Login Page </a>`)
  }
});


// Create a JWT with the supplied credentials
app.post('/jwt', async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  let url = `https://${AUTH0_DOMAIN}/oauth/token`
  let postData = { 
    grant_type: 'password',
    username: username,
    password: password,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET }
  let headers = { 'content-type': 'application/json' }
  try {
    let response = await axios.post(url, postData, headers)
    //console.log(response)
    res.status(200).send(response.data)
  } catch {
    res.status(500).send(error)
  }
});

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});