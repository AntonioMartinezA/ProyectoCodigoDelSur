import Database from 'better-sqlite3';

// Abrimos la base de datos y creamos las tablas que usamos
export function initializeDatabase(){
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
    return db;
}
// como usamos better sqlite3 no necesitamos cerrar la base de datos (no es la razon principal por lo que lo usamos)

// esta funcion busca un usuario por el email y devuelve sus datos
export function getUser(email, db){
    const stmt = db.prepare(`SELECT Email email, FirstName firstName,  LastName lastName,
                                    Password password, Blacklist blacklist
                             FROM Users
                             WHERE Email = ?`);
    let result = stmt.get(email);
    return result;
}

// agregar un user
export function addUser(email, firstName, lastName, password, blacklist, db){
    let stmt = db.prepare(`INSERT INTO users(Email, FirstName, LastName, Password, Blacklist)
                           VALUES(?, ?, ?, ?, ?)`);
    return stmt.run(email, firstName, lastName, password, blacklist);

}

// updatea la contrasena con el hash de un usuario
export function addPassword(hash, email, db){
    const stmt = db.prepare(`UPDATE Users
                             SET Password = ?
                             WHERE Email = ?`);
    return stmt.run(hash, email);
}

// cambia el blacklist de un usuario
export function blacklistUser(email, value, db){
    const stmt = db.prepare(`UPDATE Users
                             SET Blacklist = ?
                             WHERE Email = ?`);
    return stmt.run(value, email);
}

// checkea si un usuairo tiene una pelicula entre sus favoritas
export function checkFavoriteMovie(user, movieId, db){
    const stmt = db.prepare(`SELECT *
                             FROM Movies
                             WHERE Email = ? AND MovieID = ?`);
    return (stmt.get(user, movieId) == undefined);
}

// agrega una pelicula a las favoritas de un usuario
export function insertFavoriteMovie(user, movieId, date, db){
    const stmt = db.prepare(`INSERT INTO Movies(Email, MovieID, addedAT)
                             VALUES(?, ?, ?)`);
    return stmt.run(user, movieId, date);
}

// devuelve un iterador con la lista de peliculas favoritas de un usuario
export function listFavoriteMovies(user, db){
    const stmt = db.prepare(`SELECT MovieID as id
                             FROM Movies
                             WHERE Email = ?`);
    return stmt.iterate(user)
}