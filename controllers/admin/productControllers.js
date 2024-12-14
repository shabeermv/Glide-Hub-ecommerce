const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const fs = require('fs');
const path = require('path');

// Fetch all products
const productsInfo = async (req, res) => {
    try {
        const products = await Product.find().lean();
        const updatedProducts = products.map(product => ({
            ...product,
            images: product.images || [], 
        }));
        res.render('productsInfo', { updatedProducts });
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

// Add product to database
const productAdd = async (req, res) => {
    try {
        const { title, description, price, stock, brandName, category, sizes } = req.body;
        const parsedSizes = JSON.parse(sizes);

        if (!req.files || req.files.length === 0) {
            return res.status(400).send('Please upload at least one image.');
        }

        const imagePaths = req.files.map(file => file.filename);

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
        res.redirect('/admin/products');
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Product details page
const getProductDeatilsInfo = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId).populate('category', 'name').exec();

        if (!product) {
            res.status(404).json({ message: "Product Not Found" });
        }
        res.render('productDetailsInfo', { product });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
        console.log('Product Details Page error');
    }
};


const renderEditProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId);

        if (!product) {
            res.status(404).json({ message: 'Product Not Found' });
        }

        const categories = await Category.find();
        res.render('editProduct', { product, categories });
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Update product
const updateProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const { title, description, price, stock, brandName, category, sizes } = req.body;
        const parsedSizes = req.body.sizes || [];

        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        product.title = title || product.title;
        product.description = description || product.description;
        product.price = price || product.price;
        product.stock = stock || product.stock;
        product.brandName = brandName || product.brandName;
        product.category = category || product.category;
        product.sizes = parsedSizes || product.sizes;

        // If new images are uploaded, remove the old ones
        if (req.files && req.files.length > 0) {
            // Delete old images from the file system
            product.image.forEach(image => {
                const imagePath = path.join(__dirname, 'uploads', image);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            });

            // Add the new images
            const imagePaths = req.files.map(file => file.filename);
            product.image = imagePaths;
        }

        // Save the updated product
        await product.save();
        res.json({ success: true, message: 'Product updated successfully' });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// Delete product
const deleteProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId);

        if (!product) {
            res.status(404).json({ message: 'Product not found' });
        }

        // Delete images from the file system
        product.image.forEach(image => {
            const imagePath = path.join(__dirname, 'uploads', image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        });

        await Product.findByIdAndDelete(productId);
        res.status(200).json({ success: true, message: 'Product successfully deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
        console.log('Product deleting error');
    }
};

module.exports = {
    productsInfo,
    productAdd,
    addProductInfo,
    getProductDeatilsInfo,
    renderEditProduct,
    updateProduct,
    deleteProduct
};
