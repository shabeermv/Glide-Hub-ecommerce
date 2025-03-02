const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const CategoryOffer = require("../../models/categoryOffer");
const ProductOffer = require("../../models/productOffer");

const cartPageInfo = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.redirect("/login");
    }

    const cartData = await Cart.findOne({ userId }).populate(
      "product.productId"
    );

    if (cartData) {
      cartData.product = cartData.product.filter(
        (item) => item.productId !== null
      );

      const currentDate = new Date();

      for (const item of cartData.product) {
        const product = item.productId;

        item.originalPrice = product.price;
        item.hasDiscount = false;

        let finalDiscountedPrice = product.price;
        let appliedOffer = null;

        // 🔹 **Check for Product Offer**
        const productOffer = await ProductOffer.findOne({
          productId: product._id,
          startDate: { $lte: currentDate },
          endDate: { $gte: currentDate },
        });

        if (productOffer) {
          if (productOffer.discountType === "percentage") {
            finalDiscountedPrice =
              product.price * (1 - productOffer.discountValue / 100);
          } else if (productOffer.discountType === "fixed") {
            finalDiscountedPrice = product.price - productOffer.discountValue;
          }
          appliedOffer = `Product Offer: ${productOffer.description}`;
        }

        // 🔹 **Check for Category Offer (if no product offer or category discount is better)**
        if (product.category) {
          const categoryOffer = await CategoryOffer.findOne({
            categoryId: product.category,
            startDate: { $lte: currentDate },
            endDate: { $gte: currentDate },
          });

          if (categoryOffer) {
            let categoryDiscountedPrice = product.price;
            if (categoryOffer.discountType === "percentage") {
              categoryDiscountedPrice =
                product.price * (1 - categoryOffer.discountValue / 100);
            } else if (categoryOffer.discountType === "fixed") {
              categoryDiscountedPrice =
                product.price - categoryOffer.discountValue;
            }

            // 🔹 **Apply the best discount**
            if (categoryDiscountedPrice < finalDiscountedPrice) {
              finalDiscountedPrice = categoryDiscountedPrice;
              appliedOffer = `Category Offer: ${categoryOffer.description}`;
            }
          }
        }

        // ✅ Apply the best discount found
        if (finalDiscountedPrice < product.price) {
          item.price = finalDiscountedPrice;
          item.hasDiscount = true;
          item.appliedOffer = appliedOffer;
        } else {
          item.price = product.price;
        }

        // ✅ Update total price for this item
        item.totalPrice = item.price * item.quantity;
      }

      // ✅ Update total cart price
      cartData.totalPrice = cartData.product.reduce(
        (acc, item) => acc + item.totalPrice,
        0
      );
      await cartData.save();
    }

    res.render("userCart", { cart: cartData });
  } catch (error) {
    next(error);
  }
};

const addProductCart = async (req, res) => {
  const { productId, size } = req.body;
  let quantity = 1;
  const userId = req.session.userId;

  if (!size) {
    return res
      .status(400)
      .json({ success: false, message: "Size is required" });
  }

  if (!userId) {
    return res
      .status(401)
      .json({ success: false, message: "User not logged in" });
  }

  try {
    // Find product and check if it exists
    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // Check if the requested size exists and has stock
    // Compare with string value instead of number
    const sizeData = product.sizes.find((s) => s.size === size);
    if (!sizeData) {
      return res.status(400).json({
        success: false,
        message: `Size ${size} is not available for this product`,
      });
    }

    if (sizeData.stock < 1) {
      return res.status(400).json({
        success: false,
        message: `Size ${size} is out of stock`,
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({
        userId,
        product: [],
        totalPrice: 0,
      });
    }

    // Check if product with same size exists in cart
    const existingProduct = cart.product.find(
      (p) => p.productId.toString() === productId.toString() && p.size === size // Compare with string value
    );

    if (existingProduct) {
      // Check if increasing quantity exceeds available stock
      if (existingProduct.quantity + quantity > sizeData.stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${sizeData.stock} items available in this size`,
        });
      }

      // Update existing product quantity and price
      existingProduct.quantity += quantity;
      existingProduct.totalPrice =
        existingProduct.price * existingProduct.quantity;
    } else {
      // Add new product to cart
      cart.product.push({
        productId,
        size: size, // Use string size
        quantity,
        price: product.price,
        totalPrice: product.price * quantity,
      });
    }

    // Update product stock
    sizeData.stock -= quantity;
    await product.save();

    // Update cart total price
    cart.totalPrice = cart.product.reduce(
      (acc, item) => acc + item.totalPrice,
      0
    );
    await cart.save();

    // Update session cart if needed
    if (!req.session.cart) {
      req.session.cart = [];
      req.session.cart.push({ productId });
    }

    return res.status(200).json({
      success: true,
      message: "Product added to cart successfully",
      cart: {
        totalItems: cart.product.length,
        totalPrice: cart.totalPrice,
      },
    });
  } catch (error) {
    console.error("Error adding product to cart:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const addProductToCartFromWishlist = async (req, res) => {
  const { productId, size = "S", quantity = 1 } = req.query;
  const userId = req.session.userId;

  if (!userId) {
    return res
      .status(401)
      .json({ success: false, message: "User not logged in" });
  }

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({
        userId,
        product: [
          {
            productId,
            size,
            quantity,
            price: product.price,
            totalPrice: product.price * quantity,
          },
        ],
      });
    } else {
      const existingProduct = cart.product.find(
        (p) => p.productId.toString() === productId && p.size === size
      );

      if (!existingProduct) {
        cart.product.push({
          productId,
          size,
          quantity,
          price: product.price,
          totalPrice: product.price * quantity,
        });
      } else {
        existingProduct.quantity += quantity;
        existingProduct.totalPrice =
          existingProduct.price * existingProduct.quantity;
      }

      cart.totalPrice = cart.product.reduce(
        (acc, item) => acc + item.totalPrice,
        0
      );
    }

    await cart.save();

    return res
      .status(200)
      .json({ success: true, message: "Product added to cart successfully" });
  } catch (error) {
    console.error("Error adding product to cart:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const updateProductQuantity = async (req, res) => {
  try {
    const productId = req.params.id;
    const { action, size } = req.body;
    const userId = req.session.userId;

    const cart = await Cart.findOne({ userId }).populate("product.productId");
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const cartItem = cart.product.find(
      (item) =>
        item.productId._id.toString() === productId && item.size === size
    );

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Find the stock information for the specific size
    const sizeStock = product.sizes.find((s) => s.size === size);
    if (!sizeStock) {
      return res.status(400).json({
        success: false,
        message: `Size ${size} not available for this product`,
      });
    }

    // Get current availability
    const availableStock = sizeStock.stock;
    let updatedQuantity = cartItem.quantity;
    let stockWarning = null;

    if (action === "increase") {
      // Check if we're at the maximum available stock
      if (updatedQuantity >= availableStock) {
        stockWarning = `Only ${availableStock} items available in size ${size}`;
        // Don't increase quantity, but don't return an error - just warn the user
      } else {
        updatedQuantity++;
      }
    } else if (action === "decrease" && updatedQuantity > 1) {
      updatedQuantity--;
    }

    // Update cart item quantity and total price
    cartItem.quantity = updatedQuantity;

    // Check if product has discount and update prices accordingly
    if (product.hasDiscount) {
      cartItem.hasDiscount = true;
      cartItem.originalPrice = product.originalPrice;
      cartItem.price = product.discountedPrice;
      cartItem.appliedOffer = product.appliedOffer;
    }

    cartItem.totalPrice = cartItem.price * updatedQuantity;

    // Recalculate total cart price
    cart.totalPrice = cart.product.reduce(
      (total, item) => total + item.totalPrice,
      0
    );
    await cart.save();

    res.json({
      success: true,
      cart,
      stockInfo: {
        available: availableStock,
        current: updatedQuantity,
        isMaxed: updatedQuantity >= availableStock,
      },
      stockWarning,
      message: stockWarning || "Cart updated successfully",
    });
  } catch (error) {
    console.error("Update quantity error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteProductCart = async (req, res) => {
  const userId = req.session.userId;
  const productId = req.params.id;
  const { size } = req.body;

  try {
    if (!userId || !productId) {
      return res.status(400).json({
        success: false,
        message: "User ID or Product ID is missing.",
      });
    }

    // Get the cart before removing the item to access quantity info
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found.",
      });
    }

    // Find the item to be removed to get its quantity
    const itemToRemove = cart.product.find(
      (item) => item.productId.toString() === productId && item.size === size
    );

    if (!itemToRemove) {
      return res.status(404).json({
        success: false,
        message: "Product not found in cart.",
      });
    }

    // Remove the item using $pull
    const updatedCart = await Cart.findOneAndUpdate(
      { userId },
      { $pull: { product: { productId, size } } },
      { new: true }
    );

    // Recalculate total price
    if (updatedCart) {
      updatedCart.totalPrice = updatedCart.product.reduce(
        (total, item) => total + item.totalPrice,
        0
      );
      await updatedCart.save();
    }

    return res.status(200).json({
      success: true,
      message: "Product removed from cart successfully.",
      cart: updatedCart,
    });
  } catch (error) {
    console.error(error.message, "internal server error....");
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

module.exports = {
  cartPageInfo,
  addProductCart,
  deleteProductCart,
  updateProductQuantity,
  addProductToCartFromWishlist,
};
