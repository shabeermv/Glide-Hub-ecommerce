const mongoose=require('mongoose');


    const couponSchema = new mongoose.Schema({
        name: {
            type: String,
            required: true
        },
        code: {
            type: String,
            required: true
        },
        discount: { 
            type: String,
             enum: ['percentage', 'fixed'],
              required: true 
            },
        discountValue: {
             type: Number, 
             required: true 
            },
        expireDate: {
            type: Date,
            required: true
        },
        minPurchase: {
            type: Number,
            required: true
        }
    }, {timestamps: true});


module.exports=mongoose.model('Coupon',couponSchema);