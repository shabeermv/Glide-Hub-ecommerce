// app.js
const express = require('express');
const path = require('path');
const session = require('express-session');
const dotenv = require('dotenv').config();
const userRouter = require('./routers/userRouter');
const errorHandler=require('./middleware/errorHandler')
const connectDb = require('./config/db');
const adminRouter = require('./routers/adminRouter');
const nocache = require('nocache');
const passport = require('./config/passport');
const methodOverride=require('method-override')
const cors=require('cors');


connectDb();

const app = express();
app.set('view engine', 'ejs');
app.set('views', [path.join(__dirname, 'views/user'), path.join(__dirname, 'views/admin')]);


app.use(nocache());
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json());
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 1000
        },
    })
);


app.use(passport.initialize());
app.use(passport.session());
app.use(cors());
app.use('/uploads',express.static(path.join(__dirname, 'uploads')));

app.use(express.static(path.join(__dirname, 'public/asset1')));
app.use(express.static(path.join(__dirname, 'public')));


app.use('/', userRouter);
app.use('/admin', adminRouter); 
app.use(methodOverride('_method'))

app.use(errorHandler);
app.use((req, res) => {
    res.status(404).render('404');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running successfully on port ${PORT}`);
});

module.exports = app;
