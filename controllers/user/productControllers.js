const Product=require('../../models/productSchema');
const Category=require('../../models/categorySchema')


const shopInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; 
        const limit = parseInt(req.query.limit) || 10; 
        const skip = (page - 1) * limit;

        const totalProducts = await Product.countDocuments(); 
        const products = await Product.find({isDeleted:false}).skip(skip).limit(limit).lean();
        const categories = await Category.find({});


        const updatedProducts = products.map(product => ({
            ...product,
            images: product.images || [],
        }));

        res.render('products', {
            categories,
            updatedProducts,

            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
        });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
        console.log('shopInfo error', error);
    }
};


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