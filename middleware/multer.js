const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../uploads/products');
        cb(null, uploadPath); // Save files in the 'uploads/products' folder
    },
    filename: function (req, file, cb) {
        // Generate a unique filename using the current timestamp and original file extension
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

// Initialize Multer with the storage configuration
const upload = multer({ storage });

module.exports = upload;
