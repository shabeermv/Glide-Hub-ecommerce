const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");

const shopInfo = async (req, res) => {
  try {
    const searchValue = req.query.search || "";
    const categoryFilter = req.query.category || "";
    const sortBy = req.query.sort || "";
    const priceRange = req.query.priceRange || "all";
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    // Base query
    let query = { isDeleted: false };

    // Add search functionality
    if (searchValue) {
      query.$or = [
        { name: { $regex: searchValue, $options: 'i' } },
        { description: { $regex: searchValue, $options: 'i' } }
      ];
    }

    // Add price range filter to query
    if (priceRange !== "all") {
      const [minPrice, maxPrice] = priceRange.split("-").map(Number);
      query.price = {
        $gte: minPrice,
        ...(maxPrice ? { $lte: maxPrice } : {})
      };
    }

    // Apply category filter directly in the database query
    if (categoryFilter) {
      const category = await Category.findOne({ name: categoryFilter });
      if (category) {
        query.category = category._id;
      }
    }

    // Set up sorting options
    let sortOption = {};
    if (sortBy === "lowToHigh") {
      sortOption = { price: 1 };
    } else if (sortBy === "highToLow") {
      sortOption = { price: -1 };
    }

    const totalProducts = await Product.countDocuments(query);
    
    // Fetch products with applied filters
    const products = await Product.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .populate("category")
      .lean();

    const categories = await Category.find({ isDeleted: false });

    // Define price ranges for the filter
    const priceRanges = [
      { label: 'All', value: 'all' },
      { label: '₹500 - ₹1500', value: '500-1500' },
      { label: '₹1500 - ₹3000', value: '1500-3000' },
      { label: '₹3000 - ₹5000', value: '3000-5000' },
      { label: '₹5000 - ₹8000', value: '5000-8000' },
      { label: '₹8000+', value: '8000-999999' }
    ];

    const updatedProducts = products.map((product) => ({
      ...product,
      images: product.images || [],
    }));

    res.render("products", {
      categories,
      updatedProducts,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
      searchValue,
      selectedCategory: categoryFilter,
      selectedSort: sortBy,
      selectedPriceRange: priceRange,
      priceRanges
    });
  } catch (error) {
    console.error("shopInfo error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const getDetailInfo = async (req, res) => {
  try {
      const productId = req.params.id;

      // Populate the product with category information
      const product = await Product.findById(productId).populate('category');

      if (!product) {
          return res.status(404).json({ message: "Product not found" });
      }

      // Get only sizes with stock > 0
      const availableSizes = product.sizes.filter(size => size.stock > 0);
      
      const categories = await Category.find({ isDeleted: false });

      const relatedProducts = await Product.find({
          category: product.category,
          _id: { $ne: productId },
      }).limit(5);

      // Calculate total stock
      const totalStock = product.sizes.reduce((sum, size) => sum + size.stock, 0);

      res.render("productDetail", { 
          product, 
          relatedProducts, 
          categories,
          availableSizes,
          totalStock 
      });
  } catch (error) {
      res.status(500).json({ message: "Internal server error" });
      console.error("Detail page error:", error);
  }
};
module.exports = {
  shopInfo,
  getDetailInfo,
};
