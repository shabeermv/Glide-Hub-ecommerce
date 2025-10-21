const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Products = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const productOffer = require("../../models/productOffer");
const categoryOffer = require("../../models/categoryOffer");
const coupons = require("../../models/couponSchema")
const bcrypt = require("bcrypt");
const PDFDocument = require("pdfkit");
const PDFtableDocument=require("pdfkit-table")
const ExcelJS = require("exceljs");
const statusCode = require("../../utils/statusCodes");

const adminLogin = async (req, res) => {
  try {
    if (req.session.admin) {
      return res.render("adminPanel");
    }
    res.render("adminLogin");
  } catch (error) {
    console.log(error.message);
  }
};


const getHome = async (req, res) => {
  try {
    if (!req.session.admin) return res.render("adminLogin");

    const orderCount = await Order.countDocuments({
      orderStatus: { $in: ["Delivered", "Pending", "Shipped"] },
      paymentStatus: "completed",
    });

    const productCount = await Products.countDocuments();
    const categories = await Category.find();
    const orderStatuses = await Order.distinct("orderStatus");

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    // ✅ Fetch only DELIVERED orders with completed payment, latest first
    const recentOrders = await Order.find({ 
      orderStatus: "Delivered",
      paymentStatus: "completed" 
    })
      .populate("userId", "name email")
      .populate("products.productId", "title price")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // ✅ Count ONLY delivered orders for pagination
    const totalOrders = await Order.countDocuments({ 
      orderStatus: "Delivered",
      paymentStatus: "completed" 
    });

    const recentProductOffers = await productOffer.find()
      .populate("productId", "title")
      .sort({ startDate: -1 })
      .limit(5);

    const recentCategoryOffers = await categoryOffer.find()
      .populate("categoryId", "name")
      .sort({ startDate: -1 })
      .limit(5);

    const recentCoupons = await coupons.find().sort({ createdAt: -1 }).limit(5);

    const totalPages = Math.ceil(totalOrders / limit);

    const topSellingProducts = await Products.find().sort({ saleCount: -1 }).limit(5);

    const totalSalesResult = await Order.aggregate([
      { $match: { orderStatus: "Delivered", paymentStatus: "completed" } },
      { $group: { _id: null, totalSales: { $sum: "$totalAmount" } } },
    ]);

    const totalSales =
      totalSalesResult.length > 0 ? totalSalesResult[0].totalSales : 0;

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("username email createdAt");

    return res.render("adminPanel", {
      orderCount,
      productCount,
      recentUsers,
      recentOrders,
      categories,
      orderStatuses,
      currentPage: page,
      totalPages,
      totalOrders,
      totalSales,
      topSellingProducts,
      recentCategoryOffers,
      recentProductOffers,
      recentCoupons,
      selectedCategory: "All Categories",
    });
  } catch (error) {
    console.error("Error in getHome:", error.message);
    res.status(500).render("error", {
      message: "Server error while loading dashboard",
      error,
    });
  }
};

const getReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.render("report", {
        error: "Start date and end date are required",
        salesData: [],
        totalRevenue: 0,
        orderStatusCounts: {},
        totalCouponsUsed: 0,
        topCategory: null,
      });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Validation
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.render("report", {
        error: "Invalid date format",
        salesData: [],
      });
    }

    if (start > end) {
      return res.render("report", {
        error: "Start date cannot be after end date",
        salesData: [],
      });
    }

    if (start > today || end > today) {
      return res.render("report", {
        error: "Dates cannot be in the future",
        salesData: [],
      });
    }

    // 🧾 Sales by date
    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          paymentStatus: "completed",
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          totalSales: { $sum: "$totalAmount" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: "$_id",
          totalSales: 1,
          orderCount: 1,
        },
      },
    ]);

    // 🪙 Total Revenue
    const totalRevenue = salesData.reduce((sum, item) => sum + item.totalSales, 0);

    // 🧮 Order Status Counts
    const orderStatusCounts = await Order.aggregate([
      {
        $match: { createdAt: { $gte: start, $lte: end } },
      },
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    const statusCounts = {};
    orderStatusCounts.forEach((s) => (statusCounts[s._id] = s.count));

    // 🎟️ Total Coupons Used
    const totalCouponsUsed = await Order.countDocuments({
      createdAt: { $gte: start, $lte: end },
      couponCode: { $exists: true, $ne: null },
    });

    // 🏆 Top Selling Category
    const topCategoryAgg = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $unwind: "$products" },
      {
        $lookup: {
          from: "products",
          localField: "products.productId",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $lookup: {
          from: "categories",
          localField: "productInfo.category",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      { $unwind: "$categoryInfo" },
      {
        $group: {
          _id: "$categoryInfo.name",
          count: { $sum: "$products.quantity" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]);

    const topCategory = topCategoryAgg[0] || { _id: "No Data", count: 0 };

    res.render("report", {
      salesData,
      startDate,
      endDate,
      error: null,
      totalRevenue,
      orderStatusCounts: statusCounts,
      totalCouponsUsed,
      topCategory,
    });
  } catch (error) {
    console.error("Error fetching sales data:", error);
    res.render("report", {
      error: "Failed to fetch sales data",
      salesData: [],
    });
  }
};
const downloadReportPDF = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Fetch completed orders in date range
    const orders = await Order.find({
      createdAt: { $gte: start, $lte: end },
      paymentStatus: "completed",
    }).sort({ createdAt: 1 });

    if (orders.length === 0) {
      return res.status(404).send("No orders found for this date range");
    }

    const doc = new PDFtableDocument({ margin: 40, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Sales_Report_${startDate}_to_${endDate}.pdf"`
    );

    doc.pipe(res);

    // Title
    doc.fontSize(18).text("📊 Sales Report", { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .text(`Period: ${startDate} → ${endDate}`, { align: "center" });
    doc.moveDown(1);

    // Table data
    const table = {
      headers: [
        { label: "Date", property: "date", width: 90 },
        { label: "Order ID", property: "orderId", width: 100 },
        { label: "User", property: "user", width: 100 },
        { label: "Amount (₹)", property: "amount", width: 80 },
        { label: "Status", property: "status", width: 80 },
      ],
      datas: orders.map((order) => ({
        date: order.createdAt.toISOString().split("T")[0],
        orderId: order.orderId || order._id.toString().slice(-6),
        user: order.user?.username || "Guest",
        amount: order.totalAmount.toFixed(2),
        status: order.orderStatus,
      })),
    };

    await doc.table(table, {
      prepareHeader: () => doc.font("Helvetica-Bold").fontSize(12),
      prepareRow: (row, i) => doc.font("Helvetica").fontSize(10),
      columnSpacing: 5,
      padding: 5,
    });

    // Summary
    const totalSales = orders.reduce(
      (sum, order) => sum + order.totalAmount,
      0
    );
    const totalOrders = orders.length;

    doc.moveDown(1);
    doc.fontSize(12).text(`Total Orders: ${totalOrders}`);
    doc.fontSize(12).text(`Total Sales: ₹${totalSales.toFixed(2)}`);

    doc.end();
  } catch (err) {
    console.error("PDF download error:", err);
    res.status(500).send("Failed to generate PDF");
  }
};
const getSalesData = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(statusCode.BAD_REQUEST)
        .json({ error: "Start date and end date are required" });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const today = new Date();
    today.setHours(23, 59, 59, 999); // end of today

    // ✅ Validation rules
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res
        .status(statusCode.BAD_REQUEST)
        .json({ error: "Invalid date format" });
    }

    if (start > end) {
      return res
        .status(statusCode.BAD_REQUEST)
        .json({ error: "Start date cannot be after end date" });
    }

    if (start > today || end > today) {
      return res
        .status(statusCode.BAD_REQUEST)
        .json({ error: "Dates cannot be in the future" });
    }

    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          paymentStatus: "completed",
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          totalSales: { $sum: "$totalAmount" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(salesData);
  } catch (error) {
    console.error("Error fetching sales data:", error);
    res
      .status(statusCode.INTERNAL_SERVER_ERROR)
      .json({ error: "Failed to fetch sales data" });
  }
};


const filterCategoryList = async (req, res) => {
  try {
    const { categoryId } = req.query;
    const isAjaxRequest = req.xhr || req.headers.accept.indexOf("json") > -1;

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    // Build query for delivered orders with completed payment
    let query = { 
      orderStatus: "Delivered",
      paymentStatus: "completed"
    };

    if (categoryId && categoryId !== "All Categories" && categoryId !== "") {
      const products = await Products.find({ category: categoryId });
      const productIds = products.map((product) => product._id);
      query["products.productId"] = { $in: productIds };
    }

    // Fetch orders with pagination
    const recentOrders = await Order.find(query)
      .populate("userId", "name email")
      .populate("products.productId", "title price")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    // For AJAX requests, return only the table data
    if (isAjaxRequest) {
      return res.json({
        recentOrders,
        currentPage: page,
        totalPages,
        totalOrders,
      });
    }

    // For full page render, fetch all required data
    const orderCount = await Order.countDocuments({
      orderStatus: { $in: ["Delivered", "Pending", "Shipped"] },
      paymentStatus: "completed",
    });

    const productCount = await Products.countDocuments();
    const categories = await Category.find();

    const totalSalesResult = await Order.aggregate([
      { $match: { orderStatus: "Delivered", paymentStatus: "completed" } },
      { $group: { _id: null, totalSales: { $sum: "$totalAmount" } } },
    ]);

    const totalSales =
      totalSalesResult.length > 0 ? totalSalesResult[0].totalSales : 0;

    const topSellingProducts = await Products.find()
      .sort({ saleCount: -1 })
      .limit(5);

    // ✅ IMPORTANT: Fetch all missing template variables
    const recentProductOffers = await productOffer.find()
      .populate("productId", "title")
      .sort({ startDate: -1 })
      .limit(5);

    const recentCategoryOffers = await categoryOffer.find()
      .populate("categoryId", "name")
      .sort({ startDate: -1 })
      .limit(5);

    const recentCoupons = await coupons.find()
      .sort({ createdAt: -1 })
      .limit(5);

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("username email createdAt");

    const orderStatuses = await Order.distinct("orderStatus");

    // Render with ALL required variables
    return res.render("adminPanel", {
      orderCount,
      productCount,
      recentUsers,
      recentOrders,
      categories,
      orderStatuses,
      currentPage: page,
      totalPages,
      selectedCategory: categoryId || "All Categories",
      totalSales,
      topSellingProducts,
      totalOrders,
      recentProductOffers,
      recentCategoryOffers,
      recentCoupons,
    });
  } catch (error) {
    console.error("Error filtering orders by category:", error);
    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res.status(500).json({ 
        error: "Server error while filtering orders",
        message: error.message 
      });
    }
    return res.status(500).render("error", {
      message: "Server error while filtering orders",
      error,
    });
  }
};

const getFilterByDate = async (req, res) => {
  try {
    // console.log("Filter by date request parameters:", req.query);

    const { filter, startDate, endDate } = req.query;
    let start, end;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (filter) {
      case "daily":
        start = new Date(today);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;
      case "weekly":
        start = new Date(today);
        start.setDate(today.getDate() - 7);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;
      case "monthly":
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case "yearly":
        start = new Date(today.getFullYear(), 0, 1, 0, 0, 0, 0);
        end = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      case "custom":
        if (!startDate || !endDate) {
          return res
            .status(statusCode.BAD_REQUEST)
            .json({ success: false, message: "Start and end date required" });
        }
        start = new Date(`${startDate}T00:00:00.000`);
        end = new Date(`${endDate}T23:59:59.999`);
        break;
      default:
        return res
          .status(statusCode.BAD_REQUEST)
          .json({ success: false, message: "Invalid filter type" });
    }

    const query = {
      orderStatus: { $in: ["Delivered"] },
      createdAt: { $gte: start, $lte: end },
    };

    const orders = await Order.find(query)
      .populate("userId", "name email")
      .populate({ path: "products.productId", select: "title price" })
      .sort({ createdAt: -1 })
      .lean();

    let totalAmount = orders.reduce(
      (sum, order) => sum + (order.totalAmount || 0),
      0
    );
      const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("username email createdAt");
        

    res.json({
      success: true,
      orders,
      recentUsers,
      totalOrders: orders.length,
      totalAmount,
      currentPage: 1,
      totalPages: 1,
      dateRange: { start: start.toISOString(), end: end.toISOString() },
    });
  } catch (error) {
    console.error("Error fetching orders by date:", error);
    return res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const postAdmin = async (req, res) => {
  const { email, password } = req.body;
  console.log(req.body);

  try {
    const adminUser = await User.findOne({ email, isAdmin: true });
    // console.log(adminUser,'l00000000000000000000000000');

    if (!adminUser) {
      return res
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "Admin not found or unauthorized" });
    }

    const isPasswordValid = await bcrypt.compare(password, adminUser.password);
    console.log("Password validation:", isPasswordValid);

    if (!isPasswordValid) {
      console.log("password mathch alla");
      return res
        .status(statusCode.UNAUTHORIZED)
        .json({ success: false, message: "Invalid email or password" });
    }

    req.session.admin = adminUser._id;

    return res
      .status(statusCode.OK)
      .json({ success: true, message: "Login successful" });
  } catch (error) {
    console.error(error.message);
    return res
      .status(statusCode.INTERNAL_SERVER_ERROR)
      .json({ message: "internal server error" });
  }
};

const logoutAdmin = (req, res) => {
  if (req.session.user && req.session.user.isAdmin) {
    console.log("Admin is logging out");
  }

  req.session.destroy((err) => {
    if (err) {
      return res
        .status(statusCode.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: "Could not log out" });
    }
    res.clearCookie("connect.sid");
    res.render("adminLogin");
  });
};
const downloadOrdersPDF = async (req, res) => {
  try {
    const orders = await Order.find().populate("userId").sort({ createdAt: -1 });

    const doc = new PDFDocument({ margin: 30, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="orders_report.pdf"');

    doc.pipe(res);

    // Title
    doc.fontSize(20).text("Orders Report", { align: "center" }).moveDown(1.5);

    // Table headers
    const headers = ["Order ID", "Customer", "Total Amount", "Payment Status", "Date"];
    const columnWidths = [80, 150, 100, 100, 80];
    const startX = 50;
    let y = doc.y;

    doc.font("Helvetica-Bold").fontSize(12);
    headers.forEach((header, i) => {
      doc.text(header, startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), y, {
        width: columnWidths[i],
        align: "center",
      });
    });

    doc.moveDown(0.5).moveTo(startX, doc.y).lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), doc.y).stroke();

    // Table rows
    doc.font("Helvetica").fontSize(10);
    let totalSales = 0;

    orders.forEach((order) => {
      y = doc.y + 5;

      const orderId = order.orderId || order._id.toString().slice(-6).toUpperCase();
      const customer = order.userId
        ? order.userId.username || order.userId.email || order.shippingAddress?.fullName || "Unknown"
        : "Unknown";
      const totalAmount = order.totalAmount ? `₹${order.totalAmount.toFixed(2)}` : "₹0.00";
      const paymentStatus = order.paymentStatus || "N/A";
      const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "N/A";

      totalSales += order.totalAmount || 0;

      const rowData = [orderId, customer, totalAmount, paymentStatus, orderDate];
      rowData.forEach((text, i) => {
        doc.text(text, startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), y, {
          width: columnWidths[i],
          align: "center",
        });
      });

      doc.moveDown(1);
    });

    // Summary
    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(12);
    doc.text(`Total Orders: ${orders.length}`, startX, doc.y);
    doc.text(`Total Sales: ₹${totalSales.toFixed(2)}`, startX, doc.y + 15);

    doc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    if (!res.headersSent) res.status(500).send("Error generating PDF report");
  }
};
const downloadOrdersExcel = async (req, res) => {
  try {
    const orders = await Order.find().populate("userId").sort({ createdAt: -1 });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Orders Report");

    // Header row
    sheet.columns = [
      { header: "Order ID", key: "orderId", width: 20 },
      { header: "Customer", key: "customer", width: 25 },
      { header: "Total Amount", key: "totalAmount", width: 15 },
      { header: "Payment Status", key: "paymentStatus", width: 20 },
      { header: "Date", key: "orderDate", width: 20 },
    ];

    // Add rows
    let totalSales = 0;
    orders.forEach((order) => {
      const orderId = order.orderId || order._id.toString().slice(-6).toUpperCase();
      const customer = order.userId
        ? order.userId.username || order.userId.email || order.shippingAddress?.fullName || "Unknown"
        : "Unknown";
      const totalAmount = order.totalAmount || 0;
      const paymentStatus = order.paymentStatus || "N/A";
      const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "N/A";

      totalSales += totalAmount;

      sheet.addRow({ orderId, customer, totalAmount, paymentStatus, orderDate });
    });

    // Summary row
    sheet.addRow([]);
    sheet.addRow({ orderId: "Total Orders:", customer: orders.length });
    sheet.addRow({ orderId: "Total Sales:", customer: totalSales.toFixed(2) });

    // Formatting (bold headers)
    sheet.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=orders_report.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error generating Excel:", error);
    if (!res.headersSent) res.status(500).send("Error generating Excel report");
  }
};

module.exports = {
  adminLogin,
  postAdmin,
  getHome,
  getReport,
  downloadReportPDF,
  getSalesData,
  filterCategoryList,
  getFilterByDate,
  logoutAdmin,
  downloadOrdersPDF,
  downloadOrdersExcel,
};
