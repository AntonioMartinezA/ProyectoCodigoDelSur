import express from 'express';
const app = express()
const port = 3000
import fetch from 'node-fetch';
import Database from 'better-sqlite3';
import bodyParser from 'body-parser';
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import jwt from 'jsonwebtoken';

let db = new Database(':memory:');
db.pragma('journal_mode = WAL');
const stmt = db.prepare(`CREATE TABLE Users (Email TEXT PRIMARY KEY, FirstName TEXT, LastName TEXT,Password TEXT)`);
stmt.run();
const stmt2 = db.prepare(`CREATE TABLE Movies (Email TEXT , MovieID INTEGER,FOREIGN KEY (Email) REFERENCES Users (EMail) ON UPDATE CASCADE ON DELETE CASCADE, PRIMARY KEY(Email, MovieID))`);
stmt2.run();


app.use(bodyParser.urlencoded({extended: false}));

function getUser(email){
  const stmt = db.prepare(`SELECT Email email, FirstName firstName,  LastName lastName, Password password
  FROM Users
  WHERE Email = ?`);
  let result = stmt.get(email);
  return result;
}


const secretKey = '30351441';

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromUrlQueryParameter('apikey'), // Extract from 'apikey' query parameter
  secretOrKey: secretKey,
};

passport.use(new JwtStrategy(jwtOptions, (payload, done) => {
  let find = getUser(payload.sub);
  if (find) {
    return done(null, { id: payload.sub });
  } else {
    return done(null, false);
  }
}));

app.use(passport.initialize());


async function moviesGet(req, res){ 
  let url;
  if(req.query.keyword == undefined){
    url = `https://api.themoviedb.org/3/discover/movie?page=1&sort_by=popularity.desc&api_key=69eb27a6c7d6a600bdac48c1ddcf6bd0`
  }
  else{
    url = `https://api.themoviedb.org/3/discover/movie?page=1&with_keywords=${req.query.keyword}&sort_by=popularity.desc&api_key=69eb27a6c7d6a600bdac48c1ddcf6bd0`
  }
  const options = {method: 'GET', headers: {accept: 'application/json'}};
  const resMovies = await fetch(url, options)
  const data = await resMovies.json();
  res.json(data);
}

app.get('/movies', moviesGet)

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

async function addPost(req, res){
  let email = req.body.email;
  let firstName = req.body.firstName;
  let lastName = req.body.lastName;
  let password = req.body.password;
  const stmt = db.prepare(`INSERT INTO users(Email, FirstName, LastName, Password)
   VALUES(?, ?, ?, ?)`);
  const info = stmt.run(email, firstName, lastName, password);
  console.log(info)
}


app.post('/add', addPost);


function checkGet(req, res){
  let email = req.query.email;
  let row = getUser(email);
  res.json({"email":`${row.email}`, "firstName":`${row.firstName}`,"lastName":`${row.lastName}`,"password":`${row.password}`})    
}
app.get('/check', checkGet);

function closeGet(req, res){
  db.close();
  console.log(`Base de datos cerrada`); 
}
app.get('/close', closeGet);

function loginPost(req, res){
  let email = req.body.email;
  let pass = req.body.password;
  let row = getUser(email);
  if (row.password == pass ){
    let token = jwt.sign({ sub: email }, secretKey, { expiresIn: 60 * 60 });
    res.json({ token });
  }
}

// Create a JWT token and send it as a response upon successful login
app.post('/login', loginPost);

function getFavorite(req, res){
  let movieId = req.query.movieId;
  let user = req.user.id
  const stmt = db.prepare(`INSERT INTO Movies(Email, MovieID)
   VALUES(?, ?)`);
  const info = stmt.run(user, movieId);
  console.log(info);
}

app.get('/favorite', passport.authenticate('jwt', { session: false }), getFavorite);

async function getFavList(req, res){
  let user = req.user.id;
  const stmt = db.prepare(`SELECT MovieID as id
  FROM Movies
  WHERE Email = ?`);
  let count = 0;
  let data = [];
  for (let cat of stmt.iterate(user)) {
    let url = `https://api.themoviedb.org/3/movie/${cat.id}?&api_key=69eb27a6c7d6a600bdac48c1ddcf6bd0`;
    let options = {method: 'GET', headers: {accept: 'application/json'}};
    let resMovies = await fetch(url, options);
    let dataPoint = await resMovies.json();
    data[count] = dataPoint;
    count = count + 1;
    await new Promise(r => setTimeout(r, 300));;
  }
  res.json(data);
}


app.get('/favlist', passport.authenticate('jwt', { session: false }), getFavList)


app.get('/protected', passport.authenticate('jwt', { session: false }), (req, res) => {
  res.json({ message: 'You have access to this protected route!' });
});