const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const categoryOffer=require('../../models/categoryOffer');
const ProductOffer = require('../../models/productOffer');
const fs = require('fs');
const path = require('path');

const { nextTick } = require('process');
const sharp=require('sharp')


const productsInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; 
        const limit = parseInt(req.query.limit) || 12; 
        const skip = (page - 1) * limit;

        const totalProducts = await Product.countDocuments();

        const products = await Product.find()
            .populate('category', 'name')  
            .skip(skip)
            .limit(limit)
            .lean();

        const updatedProducts = products.map(product => ({
            ...product,
            image: product.image || [], 
        }));

        const totalPages = Math.ceil(totalProducts / limit);

        res.render('productsInfo', {
            updatedProducts,
            currentPage: page,
            totalPages,
            limit,
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        next(error)
        }
};

const addProductInfo = async (req, res) => {
    try {
        const categories = await Category.find({});
        res.render('productAdd', { categories });
    } catch (error) {
        console.error('Error fetching categories:', error);
        next(error)    }
};


const productAdd = async (req, res) => {
    try {
        const { title, description, price,color, brandName, category } = req.body;
        let sizesWithStock = JSON.parse(req.body.sizesWithStock);
        console.log(category, 'this is the category........');

        console.log('req.body',req.body)

        const categoryDetails = await Category.findById(category);
        if (!categoryDetails) {
            return res.status(400).json({ success: false, message: 'Invalid category.' });
        }
        const categoryName = categoryDetails.name;

        if (!Array.isArray(sizesWithStock) || sizesWithStock.length === 0) {
            return res.status(400).json({ success: false, message: 'Sizes with stock must be an array of size-stock pairs.' });
        }

        for (const size of sizesWithStock) {
            if (!size.size || typeof size.size !== 'string' || !size.stock || typeof size.stock !== 'number') {
                return res.status(400).json({
                    success: false,
                    message: 'Each size-stock pair must have a "size" (string) and "stock" (number).',
                });
            }
        }

        const totalStock = sizesWithStock.reduce((sum, size) => sum + size.stock, 0);

        if (!req.files || req.files.length === 0) {
            return res.status(400).send('Please upload at least one image.');
        }
        console.log(req.files,"req.files.........");
        

        const processedImagesDir = path.join(__dirname, '../../uploads/products'); 
 

        if (!fs.existsSync(processedImagesDir)) {
            fs.mkdirSync(processedImagesDir, { recursive: true });
        }

        console.log('req.files:', req.files);

        const imagePaths = [];
        for (const file of req.files) {
            const outputPath = path.join(processedImagesDir, `cropped-${file.filename}`);
            await sharp(file.path)
                .resize(500, 500)
                .toFile(outputPath); 

            imagePaths.push(`/uploads/products/cropped-${file.filename}`);

            fs.unlinkSync(file.path);
        }

        console.log('this is the imagePaths', imagePaths);

        const newProduct = new Product({
            title,
            description,
            price,
            brandName,
            color,
            category,
            image: imagePaths, 
            sizes: sizesWithStock,
            totalStock, 
        });

        await newProduct.save();
        console.log('new product', newProduct);
        res.status(200).json({ success: true, message: 'Product saved successfully.' });
    } catch (error) {
        console.error('Error adding product:', error);
        next(error)    }
};




const getProductDeatilsInfo = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId).populate('category', 'name').exec();

        if (!product) {
            const error=new Error('product Not Found')
            error.status=404
            throw error
        }
        res.render('productDetailsInfo', { product});
    } catch (error) {
        next(error)
    }
};


const renderEditProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        
        const product = await Product.findById(productId).populate('category');
        if (!product) {
            return res.status(404).send('Product not found');
        }

        const categories = await Category.find({});

        console.log('Product:', product);
        console.log('Categories:', categories);

        res.render('editProduct', { 
            product, 
            categories,
            title: 'Edit Product' 
        });

    } catch (error) {
        console.error('Error in renderEditProduct:', error);
        next(error)    }
};

const updateProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const { 
            title, 
            description, 
            price, 
            brandName, 
            color,
            category,
            sizesWithStock,
            removedImages
        } = req.body;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const parsedSizesWithStock = typeof sizesWithStock === 'string' ? 
            JSON.parse(sizesWithStock) : sizesWithStock;

        const parsedRemovedImages = typeof removedImages === 'string' ? 
            JSON.parse(removedImages) : removedImages || [];

        if (!title || !description || !price || !brandName || !color || !category) {
            return res.status(400).json({ 
                success: false, 
                message: 'All required fields must be provided' 
            });
        }

        if (!Array.isArray(parsedSizesWithStock) || parsedSizesWithStock.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one size with stock must be provided'
            });
        }

        for (const sizeObj of parsedSizesWithStock) {
            if (!sizeObj.size || typeof sizeObj.stock !== 'number' || sizeObj.stock < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid size or stock value provided'
                });
            }
        }

        const totalStock = parsedSizesWithStock.reduce((sum, size) => sum + size.stock, 0);

        let updatedImages = [...product.image];

        if (parsedRemovedImages.length > 0) {
            for (const imagePath of parsedRemovedImages) {
                const fullPath = path.join(__dirname, '../../', imagePath);
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                }
            }
            updatedImages = updatedImages.filter(img => !parsedRemovedImages.includes(img));
        }

        if (req.files && req.files.length > 0) {
            const processedImagesDir = path.join(__dirname, '../../uploads/products');
            
            if (!fs.existsSync(processedImagesDir)) {
                fs.mkdirSync(processedImagesDir, { recursive: true });
            }

            for (const file of req.files) {
                const outputFilename = `cropped-${file.filename}`;
                const outputPath = path.join(processedImagesDir, outputFilename);
                
                await sharp(file.path)
                    .resize(500, 500)
                    .toFile(outputPath);

                updatedImages.push(`/uploads/products/${outputFilename}`);

                fs.unlinkSync(file.path);
            }
        }

        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
            return res.status(400).json({
                success: false,
                message: 'Invalid category provided'
            });
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            {
                title,
                description,
                price,
                brandName,
                color,
                category,
                sizes: parsedSizesWithStock,
                totalStock,
                image: updatedImages
            },
            { new: true, runValidators: true }
        );

        if (!updatedProduct) {
            return res.status(500).json({
                success: false,
                message: 'Error updating product'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Product updated successfully',
            product: updatedProduct
        });

    } catch (error) {
        console.error('Error updating product:', error);
        if (req.files) {
            for (const file of req.files) {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            }
        }
        next(error)
    }
};






const softDeleteProduct = async (req, res) => {
    try {
        const productId = req.params.id;

        const product = await Product.findByIdAndUpdate(
            productId,
            { isDeleted: true },
            { new: true } 
        );

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        res.json({ success: true, message: 'Product soft deleted successfully' });
    } catch (error) {
        console.error(error);
        next(error)    }
};

const recoverProduct = async (req, res) => {
    try {
        const productId = req.params.id;

        const product = await Product.findByIdAndUpdate(
            productId,
            { isDeleted: false },
            { new: true } 
        );

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        res.json({ success: true, message: 'Product recovered successfully' });
    } catch (error) {
        console.error(error);
        next(error)    }
};





const viewProductOfferInfo = async (req, res, next) => {
    try {
        const productOffers = await ProductOffer.find()
            .populate({ path: 'productId', select: 'title' })
            .lean();

        const products = await Product.find({}, 'title').lean();

        res.render('productOffer', {
            productOffers,
            products,
        });
    } catch (error) {
        console.error('Error fetching product offers:', error);
        next(error);
    }
};

const addProductOffer = async (req, res, next) => {
    const { description, selectedProduct, discountType, discountValue, startDate, endDate } = req.body;

    console.log('This is the req.body:', req.body);

    try {
        if (!description || !selectedProduct || !discountType || !discountValue || !startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        if (!['percentage', 'fixed'].includes(discountType)) {
            return res.status(400).json({ success: false, message: 'Invalid discount type' });
        }

        const product = await Product.findById(selectedProduct);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const existingOffer = await ProductOffer.findOne({ productId: selectedProduct });
        if (existingOffer) {
            return res.status(400).json({ success: false, message: 'An offer already exists for this product' });
        }

        let discountedPrice;
        if (discountType === 'percentage') {
            discountedPrice = product.price - (product.price * (discountValue / 100));
        } else if (discountType === 'fixed') {
            discountedPrice = product.price - discountValue;
        }

        discountedPrice = Math.max(0, discountedPrice);

        discountedPrice = Math.round(discountedPrice);

        const offerProduct = new ProductOffer({
            description,
            discountType,
            discountValue,
            startDate,
            endDate,
            productId: selectedProduct
        });

        await offerProduct.save();

        product.hasDiscount = true;
        product.discountedPrice = discountedPrice;
        await product.save();

        return res.status(200).json({
            success: true,
            message: 'Product offer saved successfully.',
            discountedPrice
        });

    } catch (error) {
        console.error('Error in addProductOffer:', error);
        next(error);
    }
};

const deleteProductOffer = async (req, res, next) => {
    try {
        const offerId = req.params.id;
        const deletedOffer = await ProductOffer.findByIdAndDelete(offerId);

        if (!deletedOffer) {
            return res.status(404).json({ success: false, message: 'Offer not found.' });
        }

        const product = await Product.findById(deletedOffer.productId);
        if (product) {
            product.hasDiscount = false;
            product.discountedPrice = product.price; 
            await product.save();
        }

        res.json({ success: true, message: 'Offer deleted successfully.' });
    } catch (error) {
        console.error('Error deleting offer:', error);
        next(error);
    }
};

const editProductOffer = async (req, res, next) => {
    try {
        const offerId = req.params.id;
        const { description, discountType, discountValue, startDate, endDate } = req.body;

        const updatedOffer = await ProductOffer.findByIdAndUpdate(
            offerId,
            { description, discountType, discountValue, startDate, endDate },
            { new: true }
        );

        if (!updatedOffer) {
            return res.status(404).json({ success: false, message: 'Offer not found.' });
        }

        const product = await Product.findById(updatedOffer.productId);
        if (product) {
            let newDiscountedPrice;
            if (discountType === 'percentage') {
                newDiscountedPrice = product.price - (product.price * (discountValue / 100));
            } else if (discountType === 'fixed') {
                newDiscountedPrice = product.price - discountValue;
            }

            newDiscountedPrice = Math.max(0, newDiscountedPrice);
            newDiscountedPrice = Math.round(newDiscountedPrice);

            product.discountedPrice = newDiscountedPrice;
            await product.save();
        }

        res.json({ success: true, message: 'Offer updated successfully.', offer: updatedOffer });
    } catch (error) {
        console.error('Error updating offer:', error);
        next(error);
    }
};
    

module.exports = {
    productsInfo,
    productAdd,
    addProductInfo,
    getProductDeatilsInfo,
    renderEditProduct,
    updateProduct,
    softDeleteProduct,
    recoverProduct,
    viewProductOfferInfo,
    addProductOffer,
    deleteProductOffer,
    editProductOffer
};
