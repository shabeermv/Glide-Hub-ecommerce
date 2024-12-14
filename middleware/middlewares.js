function authMiddleware(req, res, next) {
    if (req.session.userId) {
      next();
    } else {
      res.redirect("/login");
    }
  }
  

  function signMiddleware(req,res,next){
    if(req.session.userId){
        res.redirect('/')
    }else{
        next();
    }
  }

module.exports ={ authMiddleware,signMiddleware};
