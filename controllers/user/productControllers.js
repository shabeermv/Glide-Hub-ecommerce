const Product=require('../../models/productSchema');


const shopInfo=async(req,res)=>{
    try {
        const products = await Product.find().lean(); 
        
                
                const updatedProducts = products.map(product => ({
                    ...product,
                    images: product.images || [], // Default to an empty array if `images` is missing
                }));
                res.render('products',{updatedProducts})
    } catch (error) {
        res.status(500).json({message:'internal server error'});
        console.log('shop Info error');
        
    }
}

const getDetailInfo=async(req,res)=>{
    try {
        const productId=req.params.id;

        console.log(productId,"productidddddd")

        const product=await Product.findById(productId);
        if(!product){
            return res.status(404).json({message:'product not found'})
        }
        res.render('productDetail',{product});
        
    } catch (error) {
        res.status(500).json({message:'internal server error'});
        console.log('detail page error');
        
    }
}


module.exports={
    shopInfo,
    getDetailInfo
}