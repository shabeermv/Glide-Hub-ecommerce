const User=require('../../models/userSchema');


const successLogin = async(req,res)=>{
    try {
        if(!req.user){
            return redirect('/signup')
        }
        req.session.userId = req.user._id;
        res.redirect('/');
    } catch (error) {
        console.log(error.message);
    }
}

module.exports={successLogin}
;