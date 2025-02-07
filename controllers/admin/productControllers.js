const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
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
            .populate('category', 'name')  // Populate category
            .skip(skip)
            .limit(limit)
            .lean();

        // Make sure we're using the correct property name (image, not images)
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
        const { title, description, price,color, brandName, category } = req.body;
        let sizesWithStock = JSON.parse(req.body.sizesWithStock);
        console.log(category, 'this is the category........');

        console.log('req.body',req.body)

        // Validate category
        const categoryDetails = await Category.findById(category);
        if (!categoryDetails) {
            return res.status(400).json({ success: false, message: 'Invalid category.' });
        }
        const categoryName = categoryDetails.name;

        // Validate sizesWithStock
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

        // Calculate total stock
        const totalStock = sizesWithStock.reduce((sum, size) => sum + size.stock, 0);

        // Validate product images
        if (!req.files || req.files.length === 0) {
            return res.status(400).send('Please upload at least one image.');
        }
        console.log(req.files,"req.files.........");
        

        // Define correct directory for saving images
        const processedImagesDir = path.join(__dirname, '../../uploads/products'); // Move outside controllers
 // Adjusted path

        // Ensure the directory exists
        if (!fs.existsSync(processedImagesDir)) {
            fs.mkdirSync(processedImagesDir, { recursive: true });
        }

        console.log('req.files:', req.files);

        // Process images with Sharp (resize and save)
        const imagePaths = [];
        for (const file of req.files) {
            const outputPath = path.join(processedImagesDir, `cropped-${file.filename}`);
            await sharp(file.path)
                .resize(500, 500) // Resize to 500x500 pixels
                .toFile(outputPath); // Save the processed image

            // Add the relative path for frontend access
            imagePaths.push(`/uploads/products/cropped-${file.filename}`);

            // Delete the original file after processing
            fs.unlinkSync(file.path);
        }

        console.log('this is the imagePaths', imagePaths);

        // Save the new product with totalStock and imagePaths
        const newProduct = new Product({
            title,
            description,
            price,
            brandName,
            color,
            category,
            image: imagePaths, // Changed to 'images' instead of 'image'
            sizes: sizesWithStock,
            totalStock, // Add the calculated total stock here
        });

        await newProduct.save();
        console.log('new product', newProduct);
        res.status(200).json({ success: true, message: 'Product saved successfully.' });
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
        
        // Get product with populated category
        const product = await Product.findById(productId).populate('category');
        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Get all categories
        const categories = await Category.find({});

        // Log the data being passed to verify it's correct
        console.log('Product:', product);
        console.log('Categories:', categories);

        res.render('editProduct', { 
            product, 
            categories,
            title: 'Edit Product' // Add any additional data needed by your header/footer
        });

    } catch (error) {
        console.error('Error in renderEditProduct:', error);
        res.status(500).send('Internal Server Error');
    }
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

        // Find the product
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Parse JSON strings if needed
        const parsedSizesWithStock = typeof sizesWithStock === 'string' ? 
            JSON.parse(sizesWithStock) : sizesWithStock;

        const parsedRemovedImages = typeof removedImages === 'string' ? 
            JSON.parse(removedImages) : removedImages || [];

        // Validate inputs
        if (!title || !description || !price || !brandName || !color || !category) {
            return res.status(400).json({ 
                success: false, 
                message: 'All required fields must be provided' 
            });
        }

        // Validate sizes and stock
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

        // Calculate total stock
        const totalStock = parsedSizesWithStock.reduce((sum, size) => sum + size.stock, 0);

        // Handle image updates
        let updatedImages = [...product.image]; // Start with current images

        // Remove images that were marked for removal
        if (parsedRemovedImages.length > 0) {
            // Remove files from filesystem
            for (const imagePath of parsedRemovedImages) {
                const fullPath = path.join(__dirname, '../../', imagePath);
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                }
            }
            // Remove from database array
            updatedImages = updatedImages.filter(img => !parsedRemovedImages.includes(img));
        }

        // Process and add new images if any were uploaded
        if (req.files && req.files.length > 0) {
            const processedImagesDir = path.join(__dirname, '../../uploads/products');
            
            // Ensure directory exists
            if (!fs.existsSync(processedImagesDir)) {
                fs.mkdirSync(processedImagesDir, { recursive: true });
            }

            // Process each new image
            for (const file of req.files) {
                const outputFilename = `cropped-${file.filename}`;
                const outputPath = path.join(processedImagesDir, outputFilename);
                
                // Process image with sharp
                await sharp(file.path)
                    .resize(500, 500)
                    .toFile(outputPath);

                // Add the relative path for frontend access
                updatedImages.push(`/uploads/products/${outputFilename}`);

                // Delete the original uploaded file
                fs.unlinkSync(file.path);
            }
        }

        // Validate category exists
        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
            return res.status(400).json({
                success: false,
                message: 'Invalid category provided'
            });
        }

        // Update the product with all new information
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
        // Remove any uploaded files if there was an error
        if (req.files) {
            for (const file of req.files) {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            }
        }
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
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
