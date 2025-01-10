const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const fs = require('fs');
const path = require('path');
const { nextTick } = require('process');
const sharp=require('sharp')


const productsInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; 
        const limit = parseInt(req.query.limit) || 10; 

        const skip = (page - 1) * limit;

        const totalProducts = await Product.countDocuments();

        const products = await Product.find()
            .skip(skip)
            .limit(limit)
            .lean();

        const updatedProducts = products.map(product => ({
            ...product,
            images: product.images || [], 
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
        res.status(500).send('Server error');
    }
};

// Add product page
const addProductInfo = async (req, res) => {
    try {
        const categories = await Category.find({});
        res.render('productAdd', { categories });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).send('Internal Server Error');
    }
};


const productAdd = async (req, res) => {
    try {
        const { title, description, price, stock, brandName, category, sizes } = req.body;
        const parsedSizes = JSON.parse(sizes);

        if (!req.files || req.files.length === 0) {
            return res.status(400).send('Please upload at least one image.');
        }

        // Define directory for processed images
        const processedImagesDir = path.join(__dirname, '../../uploads');

        // Ensure the directory exists
        if (!fs.existsSync(processedImagesDir)) {
            fs.mkdirSync(processedImagesDir, { recursive: true });
        }

        // Process images with Sharp
        const imagePaths = [];
        for (const file of req.files) {
            const outputPath = path.join(processedImagesDir, `cropped-${file.filename}`);
            await sharp(file.path)
                .resize(500, 500) // Resize to 500x500 pixels
                .toFile(outputPath); // Save the processed image

            imagePaths.push(`cropped-${file.filename}`);
        }

        // Save product with processed image paths
        const newProduct = new Product({
            title,
            description,
            price,
            stock,
            brandName,
            category,
            image: imagePaths,
            sizes: parsedSizes,
        });

        await newProduct.save();
        res.status(200).json({ success: true, message: 'Product saved successfully...' });
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).send('Internal Server Error');
    }
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
        const product = await Product.findById(productId);

        if (!product) {
            throw new Error('product not found');
        }

        const categories = await Category.find();
        res.render('editProduct', { product, categories });
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
};


const updateProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const { title, description, price, stock, brandName, category, sizes } = req.body;
        const parsedSizes = req.body.sizes || [];

        const product = await Product.findById(productId);

        if (!product) {
            throw new Error('product not found')
        }

        product.title = title || product.title;
        product.description = description || product.description;
        product.price = price || product.price;
        product.stock = stock || product.stock;
        product.brandName = brandName || product.brandName;
        product.category = category || product.category;
        product.sizes = parsedSizes || product.sizes;

       
        if (req.files && req.files.length > 0) {
            
            product.image.forEach(image => {
                const imagePath = path.join(__dirname, 'uploads', image);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            });

           
            const imagePaths = req.files.map(file => file.filename);
            product.image = imagePaths;
        }

        
        await product.save();
        res.json({ success: true, message: 'Product updated successfully' });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};








const softDeleteProduct = async (req, res) => {
    try {
        const productId = req.params.id;

        // Find the product and mark it as deleted
        const product = await Product.findByIdAndUpdate(
            productId,
            { isDeleted: true },
            { new: true } // Return the updated document
        );

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Respond with success
        res.json({ success: true, message: 'Product soft deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

    

module.exports = {
    productsInfo,
    productAdd,
    addProductInfo,
    getProductDeatilsInfo,
    renderEditProduct,
    updateProduct,
    softDeleteProduct
};
