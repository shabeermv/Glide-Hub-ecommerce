module.exports=function(err,req,res,next){
    console.error(err.stack);

    const statusCode=err.status||500
    const message=err.message||'Internal Server Error'

    res.status(statusCode).json({
        status:'error',
        message:message,
        stack:process.env.NODE_ENV==='development'?err.stack:undefined
    });
};

