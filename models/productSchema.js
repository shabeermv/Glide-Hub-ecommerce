// models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    title: { 
      type: String,
       required: true
       },
    description: { 
      type: String,
      required:true
     },
    brandName: {
       type: String, 
       required: true
     },
    price: { 
      type: Number, 
      required: true
     },
    discountPercentage: { 
      type: Number 
    },
    discountedPrice: { 
      type: Number
     },
    
     category: { type: mongoose.Schema.Types.ObjectId,
              ref: 'Category',
              required: true },
    
    sizes: [{
                size: { type: String, required: true },
                stock: { type: Number, required: true },
            }],
    totalStock:{
      type:Number,
      required:true

    }  ,  
    color: { 
      type: String,
      required:true
     },
    
    image: [{ 
      type: String,
      required:true
    }],
    isDeleted:{
      type:Boolean,
      default:false,
      required:true
    }
});

module.exports = mongoose.model('Product', productSchema);
