module.exports = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Log error for dev (optional)
    // console.error('ERROR 💥', err);

    res.status(err.statusCode).json({
        status: err.status,
        code: err.errorCode || 'INTERNAL_ERROR',
        message: err.message,
        // Only show stack trace in development
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};