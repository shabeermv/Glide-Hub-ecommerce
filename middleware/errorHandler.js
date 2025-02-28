// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
    // Log the error for server-side debugging
    console.error(err.stack);
  
    // Set status code (default to 500 if not specified)
    const statusCode = err.statusCode || 500;
    
    // Different handling for API vs. rendered pages
    if (req.xhr || req.headers.accept === 'application/json') {
      // For API requests
      return res.status(statusCode).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
      });
    } else {
      // For rendered pages
      return res.status(statusCode).render('error', {
        title: 'Error',
        message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
        error: process.env.NODE_ENV === 'production' ? {} : err
      });
    }
  };
  
  module.exports = errorHandler;