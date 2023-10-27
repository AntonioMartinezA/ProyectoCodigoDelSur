import express from 'express';
const app = express()
const port = 3000
import fetch from 'node-fetch';
import sqlite3 from 'sqlite3';
import bodyParser from 'body-parser';

let db = new sqlite3.Database(':memory:');
db.run(`CREATE TABLE Users (Email TEXT PRIMARY KEY, FirstName TEXT, LastName TEXT,Password TEXT)`);
//db.close();


app.use(bodyParser.urlencoded({extended: false}));


async function homeGet(req, res){ 

    const url = 'https://api.themoviedb.org/3/movie/popular?language=en-US&page=1&api_key=69eb27a6c7d6a600bdac48c1ddcf6bd0';
    const options = {method: 'GET', headers: {accept: 'application/json'}};
    fetch(url, options)
      .then(res => res.json())
      .then(json => console.log(json))
      .catch(err => console.error('error:' + err));

}

app.get('/', homeGet)

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

async function addPost(req, res){
//  let db = new sqlite3.Database(':memory:'); 
  let email = req.body.email;
  let firstName = req.body.firstName;
  let lastName = req.body.lastName;
  let password = req.body.password;
  db.run(`INSERT INTO users(Email, FirstName, LastName, Password)
   VALUES(?, ?, ?, ?)`, [email, firstName, lastName, password], function(err) {
    if (err) {
      return console.log(err.message);
    }
    // get the last insert id
    console.log(`A row has been inserted with rowid ${this.lastID}`);
  });
//  db.close();
}


app.post('/add', addPost);


function checkGet(req, res){
//  let db = new sqlite3.Database(':memory:'); 
  let email = req.query.email;
  let sql =  `SELECT Email email, FirstName firstName,  LastName lastName, Password password
          FROM Users
          WHERE Email = ?`;
  db.get(sql, [email], (err, row) => {
    if (err) {
      return console.error(err.message);
    }
    return row
      ? res.json({"email":`${row.email}`, "firstName":`${row.firstName}`,"lastName":`${row.lastName}`,"password":`${row.password}`})
      : console.log(`No playlist found with the id ${email}`);      
  });
//  db.close();
}
app.get('/check', checkGet);

function closeGet(req, res){
  db.close();
  console.log(`Base de datos cerrada`); 
}
app.get('/close', closeGet);