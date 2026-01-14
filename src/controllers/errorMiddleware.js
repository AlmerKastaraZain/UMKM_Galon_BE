module.exports = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';
    err.errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';

    res.status(err.statusCode).json({
        status: err.status,
        code: err.errorCode,
        message: err.message || "Something went very wrong, Sir."
    });
};