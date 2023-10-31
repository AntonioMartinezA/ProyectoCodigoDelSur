import express from 'express';
import fetch from 'node-fetch';
import bodyParser from 'body-parser';
import bcrypt from 'bcrypt';
import {validEmail, getRandomInt} from './utils.js';
import {getUser, initializeDatabase, addUser, addPassword, blacklistUser, checkFavoriteMovie, insertFavoriteMovie, listFavoriteMovies} from './sql.js';
import {inicializarPassport, passportMiddleware, generarToken} from './keys.js';
const app = express()
const port = 3000
const db = initializeDatabase();

//mandamos a la api al puerto para testeo
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

//usamos este middleware para poder parsear los objetos urlencoded
app.use(bodyParser.urlencoded({extended: false}));

//inicializamos passport
app.use(inicializarPassport(db));



// esta funcion agrega un usuario
async function addPost(req, res){
  try{  
    let email = req.body.email;
    if(getUser(email, db)){
      throw "There is already an user with that email";
    } else if(!validEmail(email)){
      throw "That is not a valid email";
    }
    const firstName = req.body.firstName;
    const lastName = req.body.lastName;
    // password lo agregamos como 0 pero el valor no se mantiene
    const password = `0`;
    if(email==''||firstName==''||lastName==''||!email||!firstName||!lastName){
      throw "There can not be an empty field";
    }
    const blacklist = 0;
    console.log(addUser(email, firstName, lastName, password, blacklist, db));
    const saltRounds = 10;
    bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
      if(password==''||!password){
        throw "There can not be an empty field";
      }
      addPassword(hash, email, db);
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
    let row = getUser(email, db);
    if(!row){
      throw "There is no user with that email";
    }
    res.json({"email":`${row.email}`, "firstName":`${row.firstName}`,"lastName":`${row.lastName}`,"password":`${row.password}`}) 
  } catch (err) {
    res.status(400).send(err)
  }

}


app.get('/check', checkGet);

// esta funcion verifica password y email y devuelve el token jwt
function loginPost(req, res){
  try{
    let email = req.body.email;
    let pass = req.body.password;
    let user = getUser(email, db);
    if(!user){
      throw "There is no user with that email";
    }
    // si el user hizo logout lo volvemos a habilitar
    if (user.blacklist == 1){
      blacklistUser(email, 0, db);
    }
    //usamos la funcion que compara usando el hash para verificar la contrasena
    bcrypt.compare(pass, user.password, function(err, result) {
      if (result == true ){
        //damos un token combinado con la key y el email del usuario, expira en una hora
        res.json(generarToken(email));
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

// funcion que devuelve una lista de peliculas, puede tener o no una keyword
async function moviesGet(req, res){ 
  let url;
  if(req.query.keyword == undefined || req.query.keyword == ''){
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
  // definimos una funcion de comparacion para ordenar el array
  data.results.sort(function(a, b){return b.suggestionScore - a.suggestionScore});
  res.json(data.results);
}


//ademas de la funcion de las peliculas pasamos el middleware que comprueba la validez del jwt token
app.get('/movies', passportMiddleware(), moviesGet)


//esta funcion la usamos para ver posibles errores que podria haber al querer agregar una pelicula a favoritos
async function checkError(movieId, user){
  if(!checkFavoriteMovie(user, movieId, db)){
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

// esta funcion agrega una pelicula a los favoritos de un usuario
async function getFavorite(req, res){
  try{
    const movieId = req.query.movieId;
    // el user no hay que checkear porque nos lo pasa passport con el jwt y entonces ya se checkeo su validez
    const user = req.user.id;
    await checkError(movieId, user);
    const today = new Date();
    const date = `${today.getDate()}/${today.getMonth()+1}/${today.getFullYear()}`;
    insertFavoriteMovie(user, movieId, date, db);
    res.status(201).send('successfully added');
  } catch (err) {
    res.status(400).send(err)
  }
}


app.get('/favorite', passportMiddleware(), getFavorite);

// esta funcion devuelve la lista de favoritos de un usuario
async function getFavList(req, res){
  // el user  nos lo pasa passport con el jwt que lo deja en este campo
  const user = req.user.id;
  let count = 0;
  let data = [];
  // listFavoriteMovies nos da un iterador con las peliculas favoritas
  for (let movie of listFavoriteMovies(user, db)) {
    let url = `https://api.themoviedb.org/3/movie/${movie.id}?&api_key=69eb27a6c7d6a600bdac48c1ddcf6bd0`;
    let options = {method: 'GET', headers: {accept: 'application/json'}};
    let resMovies = await fetch(url, options);
    let dataPoint = await resMovies.json();
    dataPoint.suggestionForTodayScore = getRandomInt(100);
    data[count] = dataPoint;
    count = count + 1;
    // la pagina tiene un maximo de interacciones cada 200ms entonces esperamos para que no nos de error
    await new Promise(r => setTimeout(r, 200));;
  }
  data.sort(function(a, b){return b.suggestionForTodayScore - a.suggestionForTodayScore});
  if(data.length == 0){
    res.status(200).send('this user has no favorite movies')
  } else{
    res.json(data);
  }
}


app.get('/favlist', passportMiddleware(), getFavList)

// el logout lo aplicamos manteniendo un campo blacklist que revisa si el usuario hizo un logout
// despues de su ultimo log in
function getLogout(req, res){
  let user = req.user.id;
  blacklistUser(user, 1, db)
  res.status(200).send('successfully logged out')
}


app.get('/logout', passportMiddleware(),getLogout)

