
//esta funcion checkea si el email es valido usando una expresion regular (no la hice yo la use de internet)
export function validEmail(email) {
    const filter = /^\s*[\w\-\+_]+(\.[\w\-\+_]+)*\@[\w\-\+_]+\.[\w\-\+_]+(\.[\w\-\+_]+)*\s*$/;
    return String(email).search(filter) != -1;
}

// esta funcion genera un natural al azar entre 0 y max
export function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}