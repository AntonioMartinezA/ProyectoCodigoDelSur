import express from 'express';
import fetch from 'node-fetch';
import Database from 'better-sqlite3';
import bodyParser from 'body-parser';
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
const app = express()
const port = 3000

//Abrimos la base de datos y creamos las tablas que usamos
let db = new Database('db/database.db');
db.pragma('journal_mode = WAL'); //esto es una configuracion opcional pero muy recomendada en el paquete
const stmt = db.prepare(`CREATE TABLE IF NOT EXISTS 
                          Users (Email TEXT PRIMARY KEY, FirstName TEXT, LastName TEXT,
                                  Password TEXT, Blacklist INTEGER)`);
stmt.run();
const stmt2 = db.prepare(`CREATE TABLE IF NOT EXISTS 
                          Movies (Email TEXT , MovieID INTEGER,addedAt TEXT,
                          FOREIGN KEY (Email) REFERENCES Users (EMail) ON UPDATE CASCADE ON DELETE CASCADE,
                          PRIMARY KEY(Email, MovieID))`);
stmt2.run();
//como usamos better sqlite3 no necesitamos cerrar la base de datos (no es la razon principal por lo que lo usamos)

//mandamos a la api al puerto para testeo
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

//usamos este middleware para poder parsear los objetos urlencoded
app.use(bodyParser.urlencoded({extended: false}));

//esta funcion busca un usuario por el email y devuelve sus datos
function getUser(email){
  const stmt = db.prepare(`SELECT Email email, FirstName firstName,  LastName lastName,
                                  Password password, Blacklist blacklist
                           FROM Users
                           WHERE Email = ?`);
  let result = stmt.get(email);
  return result;
}

//aca empezamos primero los settings de permisos con una key
const secretKey = '30351441';

//las opciones de verificacion, jwt pasa por query en el campo apikey, usando una secretkey
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromUrlQueryParameter('apikey'),
  secretOrKey: secretKey,
};

//funcion que utiliza passport para verificar si la key es correcta
passport.use(new JwtStrategy(jwtOptions, (payload, done) => {
  //la key que generamos usa el email del usuario entonces payload.sub es el email
  let user = getUser(payload.sub);
  //mantenemos un campo para revisar si el usuairo hizo log out
  if (user.blacklist == 1){
    return done(null, false);
  } else if (user) {
    return done(null, { id: payload.sub });
  } else {
    return done(null, false);
  }
}));

//inicializamos passport
app.use(passport.initialize());


//esta funcion checkea si el email es valido usando una expresion regular (no la hice yo la use de internet)
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
    if(email==''||firstName==''||lastName==''||!email||!firstName||!lastName){
      throw "There can not be an empty field";
    }
// lo primero fue revisar que los campos sean validos, password lo agregamos como 0 pero el valor no se mantiene
    const blacklist = 0;
    let stmt = db.prepare(`INSERT INTO users(Email, FirstName, LastName, Password, Blacklist)
                           VALUES(?, ?, ?, ?, ?)`);
    let info = stmt.run(email, firstName, lastName, password, blacklist);
    console.log(info)
// una vez agregado el usuario en la base de datos falta updatear el password, se trata de hacerlo 
// en el mismo comando que cuando se lee por recomendaciones de seguridad
    const saltRounds = 10;
    bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
      if(password==''||!password){
        throw "There can not be an empty field";
      }
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
//obtenemos los campos y checkeamos que exista el user
    let email = req.body.email;
    let pass = req.body.password;
    let user = getUser(email);
    if(!user){
      throw "There is no user with that email";
    }
// si el user hizo logout lo volvemos a habilitar
    if (user.blacklist == 1){
      const stmt = db.prepare(`UPDATE Users
                               SET Blacklist = ?
                               WHERE Email = ?`);
      stmt.run(0, email);
    }
//usamos la funcion que compara usando el hash para verificar la contrasena
    bcrypt.compare(pass, user.password, function(err, result) {
      if (result == true ){
//damos un token combinado con la key y el email del usuario, expira en una hora
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


app.post('/login', loginPost);

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

async function moviesGet(req, res){ 
  let url;
// primero pedimos las peliculas separando cuando hay una keyword de cuando no
  if(req.query.keyword == undefined || req.query.keyword == ''){
    url = `https://api.themoviedb.org/3/discover/movie?page=1&sort_by=popularity.desc&api_key=69eb27a6c7d6a600bdac48c1ddcf6bd0`
  }
  else{
    url = `https://api.themoviedb.org/3/discover/movie?page=1&with_keywords=${req.query.keyword}&sort_by=popularity.desc&api_key=69eb27a6c7d6a600bdac48c1ddcf6bd0`
  }
  const options = {method: 'GET', headers: {accept: 'application/json'}};
  const resMovies = await fetch(url, options)
  let data = await resMovies.json();
// una vez tenemos las peliculas le agregamos el campo suggestion score
  for(let item of data.results){
    item.suggestionScore = getRandomInt(100)
  }
// ordenamos los datos de suggestion score definiendo una funcion de comparacion
  data.results.sort(function(a, b){return b.suggestionScore - a.suggestionScore});
  res.json(data.results);
}


//ademas de la funcion de las peliculas pasamos el middleware que comprueba la validez del jwt token
app.get('/movies', passport.authenticate('jwt', { session: false }), moviesGet)


//esta funcion la usamos para ver posibles errores que podria haber al querer agregar uan pelicula a favoritos
async function checkError(movieId, user){
// un error es si la pelicula ya la tiene en favoritos
  const stmt = db.prepare(`SELECT *
                           FROM Movies
                           WHERE Email = ? AND MovieID = ?`);
  let result = stmt.get(user, movieId);
  if(result){
    throw "This user has already that movie in his favorite list";
  }
//el otro es si no existe la pelicula con ese id
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
// primero pedimos los datos y revisamos la validez de la pelicula para agregar
    const movieId = req.query.movieId;
// el user no hay que checkear porque nos lo pasa passport con el jwt y entonces ya se checkeo su validez
    const user = req.user.id;
    await checkError(movieId, user);
// despues creamos objeto con la fecha actual y lo agregamos (el default es la fecha actual)
    const today = new Date();
    const date = `${today.getDate()}/${today.getMonth()+1}/${today.getFullYear()}`
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
// el user  nos lo pasa passport con el jwt que lo deja en este campo
  const user = req.user.id;
// seleccionamos todas las peliculas favoritas del usuario
  const stmt = db.prepare(`SELECT MovieID as id
                           FROM Movies
                           WHERE Email = ?`);
  let count = 0;
  let data = [];
// stmt.iterate nos da un iterador con el resultado del SELECT
  for (let movie of stmt.iterate(user)) {
// pedimos los datos de la pelicula para cada pelicula
    let url = `https://api.themoviedb.org/3/movie/${movie.id}?&api_key=69eb27a6c7d6a600bdac48c1ddcf6bd0`;
    let options = {method: 'GET', headers: {accept: 'application/json'}};
    let resMovies = await fetch(url, options);
    let dataPoint = await resMovies.json();
// le agregamor el suggestionForTodayScore
    dataPoint.suggestionForTodayScore = getRandomInt(100);
// usamos un array para guardar las peliculas
    data[count] = dataPoint;
    count = count + 1;
// la pagina tiene un maximo de interacciones cada 200ms entonces esperamos para que no nos de error
    await new Promise(r => setTimeout(r, 200));;
  }
//ordenamos el array creando una funcion de comparacion
  data.sort(function(a, b){return b.suggestionForTodayScore - a.suggestionForTodayScore});
  if(data.length == 0){
    res.status(200).send('this user has no favorite movies')
  } else{
    res.json(data);
  }
}


app.get('/favlist', passport.authenticate('jwt', { session: false }), getFavList)

// el logout lo aplicamos manteniendo un campo blacklist que revisa si el usuario hizo un logout
// despues de su ultimo log in
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
