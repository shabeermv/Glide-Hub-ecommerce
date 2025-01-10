const mongoose=require('mongoose');

const addressSchema=new mongoose.Schema({
    userId:{
        type:String,
        required:true
    },
    name:{
        type:String,
        required:true
    },
    pincode:{
        type:Number,
        required:true
    },
    locality:{
        type:String,
        required:true
    },
    address:{
        type:String,
        required:true
    },
    city:{
        type:String,
        required:true
    },
    state:{
        type:String,
        required:true
    },
    addressType:{
        type:String,
        required:true
    },
    isDeleted:{
        type:Boolean,
        default:false
    }
},{timestamps:true});


const Address=mongoose.model('Address',addressSchema);

mongoose.exports=Address;