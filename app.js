require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const userRouter = require('./routers/userRouter');
const errorHandler = require('./middleware/errorHandler');
const connectDb = require('./config/db');

const adminRouter = require('./routers/adminRouter');
const nocache = require('nocache');

require('./config/passport');
const passport = require('passport'); 
const methodOverride = require('method-override');
const cors = require('cors');

connectDb();

const app = express();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', [
  path.join(__dirname, 'views/user'), 
  path.join(__dirname, 'views/admin')
]);

// Trust proxy (important for production)
app.set('trust proxy', 1);

// CORS setup (before other middleware)
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : 'http://localhost:3000', // Changed: environment-based origin
  credentials: true
}));

// Basic middleware
app.use(nocache());
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(methodOverride('_method'));

// Session configuration - improved for Google Auth
app.use(
  session({
    secret: process.env.SESSION_SECRET ,
    resave: false,
    saveUninitialized: false,
    name: 'sessionId', // Added: custom session name for security
    cookie: {
      secure: process.env.NODE_ENV === 'production', // Changed: environment-based secure flag
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax' // Added: helps with OAuth redirects
    }
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public/asset1')));
app.use(express.static(path.join(__dirname, 'public')));

// Global middleware for user data
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.isAuthenticated = req.isAuthenticated(); // Added: helper for templates
  
  next();
});

// Routes
app.use('/', userRouter);
app.use('/admin', adminRouter);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).render('404');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running successfully on port ${PORT}`);
  // console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;