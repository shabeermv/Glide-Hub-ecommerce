const User=require('../../models/userSchema');
const bcrypt=require('bcrypt');



const adminLogin=async(req,res)=>{
    try{
        res.render('adminLogin')

    }catch(error){
        console.log(error.message);
        
    }
}
const getHome=async(req,res)=>{
    try{
        res.render('adminPanel')

    }catch(error){
        console.log(error.message);
        
    }
}
const postAdmin = async (req, res) => {
    const { email, password } = req.body;
     
    
    
    try {
        const validAdmin=await User.findOne({email:email});

       
        if(validAdmin&&validAdmin.isAdmin==true){
          return res.status(200).json({success:true})
        }else{
            res.json({success:false})
        }
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};





module.exports={
   adminLogin,postAdmin,getHome
}