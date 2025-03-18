const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    
    const isAdmin = req.originalUrl.includes('/admin');
    let user = null;
    
    // Get user from session if available
    if (req.session && req.session.userId) {
        user = { id: req.session.userId }; // Basic user object
    }
    
    try {
        // Set status code based on error type
        const statusCode = err.statusCode || 500;
        
        if (isAdmin) {
            res.status(statusCode).render('admin/error', {
                message: err.message || 'Internal Server Error',
                error: process.env.NODE_ENV === 'development' ? err : {}
            });
        } else {
            res.status(statusCode).render('user/error', {
                message: err.message || 'Internal Server Error',
                user: user,
                error: process.env.NODE_ENV === 'development' ? err : {}
            });
        }
    } catch (renderError) {
        console.error('Error rendering error page:', renderError);
        res.status(500).send('Internal Server Error');
    }
};

module.exports = errorHandler;