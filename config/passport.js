
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema');

console.log(process.env.GOOGLE_CLIENT_ID,'blabal');
console.log(process.env.GOOGLE_CLIENT_SECRET,'bla')

let serverURL="https://shabeerali.online/auth/google/callback";
let localURL='http://localhost:3000/auth/google/callback'

passport.use(
  new GoogleStrategy(
    {
      clientID:process.env.GOOGLE_CLIENT_ID,
clientSecret: process.env.GOOGLE_CLIENT_SECRET,

      callbackURL: serverURL
        },
        async (req, accessToken, refreshToken, profile, done) => {
          try {
            let user = await User.findOne({ googleId: profile.id });
            if (user) {
              return done(null, user);
            } else {
              
              user = new User({
                name: profile.displayName,
                email: profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null,
                googleId: profile.id,
              });
              await user.save();
              return done(null, user);
            }
          } catch (error) {
            return done(error, null);
          }
        }
      )
    );
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .then((user) => {
      done(null, user);
    })
    .catch((error) => {
      done(error, null);
    });
});

module.exports = passport;
