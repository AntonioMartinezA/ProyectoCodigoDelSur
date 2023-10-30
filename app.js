import express from 'express';
const app = express()
const port = 3000
import fetch from 'node-fetch';
import Database from 'better-sqlite3';
import bodyParser from 'body-parser';
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

let db = new Database(':memory:');
db.pragma('journal_mode = WAL');
const stmt = db.prepare(`CREATE TABLE Users (Email TEXT PRIMARY KEY, FirstName TEXT, LastName TEXT, Password TEXT, Blacklist INTEGER)`);
stmt.run();
const stmt2 = db.prepare(`CREATE TABLE Movies (Email TEXT , MovieID INTEGER,addedAt TEXT,FOREIGN KEY (Email) REFERENCES Users (EMail) ON UPDATE CASCADE ON DELETE CASCADE, PRIMARY KEY(Email, MovieID))`);
stmt2.run();



app.use(bodyParser.urlencoded({extended: false}));

function getUser(email){
  const stmt = db.prepare(`SELECT Email email, FirstName firstName,  LastName lastName, Password password, Blacklist blacklist
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

const blacklist = new Set();

passport.use(new JwtStrategy(jwtOptions, (payload, done) => {
  let find = getUser(payload.sub);
  if (find.blacklist == 1){
    return done(null, false);
  } else if (find) {
    return done(null, { id: payload.sub });
  } else {
    return done(null, false);
  }
}));

app.use(passport.initialize());


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

function validEmail(e) {
  const filter = /^\s*[\w\-\+_]+(\.[\w\-\+_]+)*\@[\w\-\+_]+\.[\w\-\+_]+(\.[\w\-\+_]+)*\s*$/;
  return String(e).search(filter) != -1;
}

async function addPost(req, res){
  try{  
    const email = req.body.email;
    if(getUser(email)){
      throw "There is already an user with that email";
    } else if(!validEmail(email)){
      throw "That is not a valid email";
    }
    const firstName = req.body.firstName;
    const lastName = req.body.lastName;
    const password = `0`;
    if(email==''||firstName==''||lastName==''||password==''){
      throw "There can not be an empty field";
    }
    const blacklist = 0;
    let stmt = db.prepare(`INSERT INTO users(Email, FirstName, LastName, Password, Blacklist)
    VALUES(?, ?, ?, ?, ?)`);
    let info = stmt.run(email, firstName, lastName, password, blacklist);
    console.log(info)
    const saltRounds = 10;
    bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
      const stmt = db.prepare(`UPDATE Users
                                SET Password = ?
                                WHERE Email = ?`);
      stmt.run(hash, email);
    });
    res.status(201).send('successfully added');
  } catch (err) {
    res.status(400).send(err)
  }
}


app.post('/add', addPost);


function checkGet(req, res){
  let email = req.query.email;
  try{
    let row = getUser(email);
    if(!row){
      throw "There is no user with that email";
    }
    res.json({"email":`${row.email}`, "firstName":`${row.firstName}`,"lastName":`${row.lastName}`,"password":`${row.password}`}) 
  } catch (err) {
    res.status(400).send(err)
  }

}

app.get('/check', checkGet);

function loginPost(req, res){
  try{
    let email = req.body.email;
    let pass = req.body.password;
    let row = getUser(email);
    if(!row){
      throw "There is no user with that email";
    }
    if (row.blacklist == 1){
      const stmt = db.prepare(`UPDATE Users
                            SET Blacklist = ?
                            WHERE Email = ?`);
      stmt.run(0, email);
    }
    bcrypt.compare(pass, row.password, function(err, result) {
      if (result == true ){
        let token = jwt.sign({ sub: email }, secretKey, { expiresIn: 60 * 60 });
        res.json({ token });
      }
      else{
        res.status(400).send('Incorrect Password')
      }
    });
  } catch (err) {
    res.status(400).send(err)
  }
}

// Create a JWT token and send it as a response upon successful login
app.post('/login', loginPost);

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

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
  let data = await resMovies.json();
  for(let item of data.results){
    item.suggestionScore = getRandomInt(100)
  }
  data.results.sort(function(a, b){return b.suggestionScore - a.suggestionScore});
  res.json(data.results);
}

app.get('/movies', passport.authenticate('jwt', { session: false }), moviesGet)

async function checkError(movieId, user){
  const stmt = db.prepare(`SELECT *
  FROM Movies
  WHERE Email = ? AND MovieID = ?`);
  let result = stmt.get(user, movieId);
  if(result){
    throw "This user has already that movie in his favorite list";
  }
  let url = `https://api.themoviedb.org/3/movie/${movieId}?&api_key=69eb27a6c7d6a600bdac48c1ddcf6bd0`;
  let options = {method: 'GET', headers: {accept: 'application/json'}};
  let resMovies = await fetch(url, options);
  let data = await resMovies.json();
  if(!data.id){
    throw "There is not a movie with that id"
  }
}

async function getFavorite(req, res){
  try{
    const movieId = req.query.movieId;
    const user = req.user.id;
    await checkError(movieId, user);
    const d = new Date();
    const date = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`
    const stmt = db.prepare(`INSERT INTO Movies(Email, MovieID, addedAT)
    VALUES(?, ?, ?)`);
    const info = stmt.run(user, movieId, date);
    console.log(info);
    res.status(201).send('successfully added');
  } catch (err) {
    res.status(400).send(err)
  }
}

app.get('/favorite', passport.authenticate('jwt', { session: false }), getFavorite);

async function getFavList(req, res){
  const user = req.user.id;
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
    dataPoint.suggestionForTodayScore = getRandomInt(100);
    data[count] = dataPoint;
    count = count + 1;
    await new Promise(r => setTimeout(r, 200));;
  }
  data.sort(function(a, b){return b.suggestionForTodayScore - a.suggestionForTodayScore});
  if(data.length == 0){
    res.status(200).send('this user has no favorite movies')
  } else{
    res.json(data);
  }
}


app.get('/favlist', passport.authenticate('jwt', { session: false }), getFavList)

function getLogout(req, res){
  let user = req.user.id;
  const stmt = db.prepare(`UPDATE Users
                           SET Blacklist = ?
                           WHERE Email = ?`);
  const info = stmt.run(1, user);
  console.log(info);
  res.status(200).send('successfully logged out')
}

app.get('/logout', passport.authenticate('jwt', { session: false }),getLogout)
