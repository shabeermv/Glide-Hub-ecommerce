// errorHandler.js
const errorHandler = (err, req, res, next) => {
  console.error(err);
  
  // Determine status code
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  
  // Check if it's an API request
  const isApiRequest = req.path.startsWith('/api') || 
                       req.xhr || 
                       req.headers.accept.indexOf('json') > -1;
  
  if (isApiRequest) {
      // Return JSON error for API requests
      return res.status(statusCode).json({
          success: false,
          message: err.message || 'Server Error',
          stack: process.env.NODE_ENV === 'development' ? err.stack : {}
      });
  }
  
  // For regular requests, render error page
  // Check which view directory to use
  const viewPrefix = req.originalUrl.startsWith('/admin') ? 'admin' : 'user';
  
  // Provide default error message
  const errorMessage = err.message || 'An unexpected error occurred';
  
  res.status(statusCode).render(`${viewPrefix}/error`, {
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? err : {}
  });
};

module.exports = errorHandler;