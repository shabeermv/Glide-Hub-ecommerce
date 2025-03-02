const User=require('../models/userSchema');


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
function distroyByBlocking(req,res,next){
  if(req.session.userId){
    const user=User.findById(userId);
    console.log(user,'user ne kitttttiiiiiii')
    if(user.isBlocked==true){
      session.distroy();
    }
  }
  else{
    next();
  }
}
const adminAuth = (req, res, next) => {
  if (req.session && req.session.admin) {
      return next();
  } else {
      return res.redirect('/admin/login');
  }
};
 

module.exports ={ authMiddleware,signMiddleware,distroyByBlocking,adminAuth};
