const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const CategoryOffer = require("../../models/categoryOffer");
const ProductOffer = require("../../models/productOffer"); // Add this import

const shopInfo = async (req, res) => {
  try {
    const searchValue = req.query.search || "";
    const categoryFilter = req.query.category || "";
    const sortBy = req.query.sort || "";
    const priceRange = req.query.priceRange || "all";

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    let query = { isDeleted: false };

    if (searchValue) {
      query.$or = [
        { title: { $regex: searchValue, $options: "i" } },
        { description: { $regex: searchValue, $options: "i" } }
      ];
    }

    if (priceRange !== "all") {
      const [minPrice, maxPrice] = priceRange.split("-").map(Number);
      query.price = {
        $gte: minPrice,
        ...(maxPrice ? { $lte: maxPrice } : {})
      };
    }

    if (categoryFilter) {
      const category = await Category.findOne({ name: categoryFilter });
      if (category) {
        query.category = category._id;
      }
    }

    let sortOption = {};
    if (sortBy === "lowToHigh") {
      sortOption = { price: 1 };
    } else if (sortBy === "highToLow") {
      sortOption = { price: -1 };
    }

    const totalProducts = await Product.countDocuments(query);

    // Fetch products along with category details
    const products = await Product.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .populate("category")
      .lean();

    const categories = await Category.find({ isDeleted: false });

    // Get unique category IDs from products
    const categoryIds = [...new Set(products.map((p) => p.category?._id?.toString()).filter(Boolean))];

    // Get all product IDs
    const productIds = products.map((p) => p._id);

    // Fetch only relevant category offers
    const categoryOffers = await CategoryOffer.find({
      categoryId: { $in: categoryIds },
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    }).lean();

    // Fetch product offers
    const productOffers = await ProductOffer.find({
      productId: { $in: productIds },
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    }).lean();

    // Apply discounts to products based on their category and product offers
    const updatedProducts = products.map((product) => {
      let discountedPrice = product.price;
      let appliedOffer = null;
      let offerType = null;
    
      // Ensure the product has all necessary properties
      if (!product._id) {
        return {
          ...product,
          image: product.image || [],
          originalPrice: product.price,
          discountedPrice: product.price,
          hasDiscount: false,
          appliedOffer: null,
          offerType: null
        };
      }
    
      // Check for product-specific offer
      const productOffer = productOffers.find(
        (offer) => offer.productId.toString() === product._id.toString()
      );
    
      // Check for category offer (only if product has a category)
      let categoryOffer = null;
      if (product.category && product.category._id) {
        categoryOffer = categoryOffers.find(
          (offer) => offer.categoryId.toString() === product.category._id.toString()
        );
      }
    
      // Calculate discounts for both offer types
      let productDiscountAmount = 0;
      let categoryDiscountAmount = 0;
    
      // Calculate product offer discount
      if (productOffer) {
        if (productOffer.discountType === "percentage") {
          productDiscountAmount = (product.price * productOffer.discountValue) / 100;
        } else if (productOffer.discountType === "fixed") {
          productDiscountAmount = productOffer.discountValue;
        }
      }
    
      // Calculate category offer discount
      if (categoryOffer) {
        if (categoryOffer.discountType === "percentage") {
          categoryDiscountAmount = (product.price * categoryOffer.discountValue) / 100;
        } else if (categoryOffer.discountType === "fixed") {
          categoryDiscountAmount = categoryOffer.discountValue;
        }
      }
    
      // Apply the better offer (higher discount)
      if (productDiscountAmount > 0 || categoryDiscountAmount > 0) {
        if (productDiscountAmount >= categoryDiscountAmount) {
          discountedPrice = product.price - productDiscountAmount;
          appliedOffer = {
            discountType: productOffer.discountType,
            discountValue: productOffer.discountValue,
            discountAmount: productDiscountAmount,
            description: productOffer.description
          };
          offerType = "product";
        } else {
          discountedPrice = product.price - categoryDiscountAmount;
          appliedOffer = {
            discountType: categoryOffer.discountType,
            discountValue: categoryOffer.discountValue,
            discountAmount: categoryDiscountAmount,
            description: categoryOffer.description || `${product.category.name} Category Offer`
          };
          offerType = "category";
        }
    
        // Ensure minimum price of ₹1
        if (discountedPrice < 1) discountedPrice = 1;
      }
    
      return {
        ...product,
        originalPrice: product.price,
        discountedPrice: discountedPrice,
        hasDiscount: !!appliedOffer,
        appliedOffer: appliedOffer,
        offerType: offerType
      };
    });
    
    const priceRanges = [
      { label: "All", value: "all" },
      { label: "₹500 - ₹1500", value: "500-1500" },
      { label: "₹1500 - ₹3000", value: "1500-3000" },
      { label: "₹3000 - ₹5000", value: "3000-5000" },
      { label: "₹5000 - ₹8000", value: "5000-8000" },
      { label: "₹8000+", value: "8000-999999" }
    ];

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
    
    const product = await Product.findById(productId).populate('category');
    
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    const availableSizes = product.sizes.filter(size => size.stock > 0);
    const categories = await Category.find({ isDeleted: false });
    
    // Get category ID for fetching offers
    const categoryId = product.category?._id;
    
    // Fetch relevant category offer
    const categoryOffer = categoryId ? await CategoryOffer.findOne({
      categoryId: categoryId,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    }).lean() : null;
    
    // Fetch product offer
    const productOffer = await ProductOffer.findOne({
      productId: productId,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    }).lean();
    
    // Apply discount calculation logic
    let discountedPrice = product.price;
    let appliedOffer = null;
    let offerType = null;
    
    // Calculate discounts for both offer types
    let productDiscountAmount = 0;
    let categoryDiscountAmount = 0;
    
    // Calculate product offer discount
    if (productOffer) {
      if (productOffer.discountType === "percentage") {
        productDiscountAmount = (product.price * productOffer.discountValue) / 100;
      } else if (productOffer.discountType === "fixed") {
        productDiscountAmount = productOffer.discountValue;
      }
    }
    
    // Calculate category offer discount
    if (categoryOffer) {
      if (categoryOffer.discountType === "percentage") {
        categoryDiscountAmount = (product.price * categoryOffer.discountValue) / 100;
      } else if (categoryOffer.discountType === "fixed") {
        categoryDiscountAmount = categoryOffer.discountValue;
      }
    }
    
    // Apply the better offer (higher discount)
    if (productDiscountAmount > 0 || categoryDiscountAmount > 0) {
      if (productDiscountAmount >= categoryDiscountAmount) {
        discountedPrice = product.price - productDiscountAmount;
        appliedOffer = {
          discountType: productOffer.discountType,
          discountValue: productOffer.discountValue,
          discountAmount: productDiscountAmount,
          description: productOffer.description
        };
        offerType = "product";
      } else {
        discountedPrice = product.price - categoryDiscountAmount;
        appliedOffer = {
          discountType: categoryOffer.discountType,
          discountValue: categoryOffer.discountValue,
          discountAmount: categoryDiscountAmount,
          description: categoryOffer.description || `${product.category.name} Category Offer`
        };
        offerType = "category";
      }
      
      // Ensure minimum price of ₹1
      if (discountedPrice < 1) discountedPrice = 1;
    }
    
    // Add discount information to product
    const enrichedProduct = {
      ...product._doc,
      originalPrice: product.price,
      discountedPrice: discountedPrice,
      hasDiscount: !!appliedOffer,
      appliedOffer: appliedOffer,
      offerType: offerType
    };
    
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: productId },
    }).limit(5);
    
    const totalStock = product.sizes.reduce((sum, size) => sum + size.stock, 0);
    
    res.render("productDetail", {
      product: enrichedProduct,
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
