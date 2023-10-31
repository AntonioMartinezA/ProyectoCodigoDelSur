import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import jwt from 'jsonwebtoken';
import {getUser} from './sql.js';



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

export function generarToken(email){
    return jwt.sign({ sub: email }, secretKey, { expiresIn: 60 * 60 })
}

export function inicializarPassport(db){
    passport.use(new JwtStrategy(jwtOptions, (payload, done) => {
        //la key que generamos usa el email del usuario entonces payload.sub es el email
        let user = getUser(payload.sub, db);
        //mantenemos un campo para revisar si el usuairo hizo log out
        if (user.blacklist == 1){
          return done(null, false);
        } else if (user) {
          return done(null, { id: payload.sub });
        } else {
          return done(null, false);
        }
    }));
    return passport.initialize()
}

export function passportMiddleware(){
    return passport.authenticate('jwt', { session: false })
}