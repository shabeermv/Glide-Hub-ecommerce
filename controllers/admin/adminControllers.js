const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Products=require('../../models/productSchema');
const Category=require('../../models/categorySchema');
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const adminLogin = async (req, res) => {
    try {
        if (req.session.admin) {
            return res.render('adminPanel');
        }
        res.render('adminLogin');
    } catch (error) {
        console.log(error.message);
    }
};



const getHome = async (req, res) => {
    try {
        if (req.session.admin) {
            const orderCount = await Order.countDocuments();
            const productCount = await Products.countDocuments();
            const categories = await Category.find();
            const orderStatuses = await Order.distinct('orderStatus');

            const page = parseInt(req.query.page) || 1;
            const limit = 5;
            const skip = (page - 1) * limit;

            const recentOrders = await Order.find()
                .populate('userId', 'name email')
                .populate('products.productId', 'title price')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            // ✅ Ensure `totalOrders` is properly counted
            const totalOrders = await Order.countDocuments();

            const totalPages = Math.ceil(totalOrders / limit);

            // ✅ Fetch top 5 best-selling products
            const topSellingProducts = await Products.find()
                .sort({ saleCount: -1 }) // Sort by highest sale count
                .limit(5);

            // ✅ Calculate Total Sales Revenue (only completed orders)
            const totalSalesResult = await Order.aggregate([
                { $match: { paymentStatus: "Completed" } }, // Count only paid orders
                { $group: { _id: null, totalSales: { $sum: "$totalAmount" } } }
            ]);

            const totalSales = totalSalesResult.length > 0 ? totalSalesResult[0].totalSales : 0;

            return res.render('adminPanel', { 
                orderCount, 
                productCount, 
                recentOrders,
                categories,
                orderStatuses,
                currentPage: page,
                totalPages,
                totalOrders, // ✅ Ensure this is passed
                totalSales,  // ✅ Ensure this is passed
                topSellingProducts,
                selectedCategory: 'All Categories' 
            });
        }
        res.render('adminLogin');
    } catch (error) {
        console.error("Error in getHome:", error.message);
        res.status(500).render('error', {
            message: 'Server error while loading dashboard',
            error
        });
    }
};



// Add this to your controller file

const getSalesData = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: "Start date and end date are required" });
        }
        
        // Create date objects with time set to start and end of day
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        // Aggregate sales data by date
        const salesData = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: start, $lte: end },
                    paymentStatus: "completed" // Changed to lowercase to match schema
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    totalSales: { $sum: "$totalAmount" },
                    orderCount: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 } // Sort by date ascending
            }
        ]);
        
        res.json(salesData);
    } catch (error) {
        console.error("Error fetching sales data:", error);
        res.status(500).json({ error: "Failed to fetch sales data" });
    }
};

// Export and add to your routes



const filterCategoryList = async(req, res) => {
    try {
        const { categoryId } = req.query;
        const isAjaxRequest = req.xhr || req.headers.accept.indexOf('json') > -1;

        let orderCount = await Order.countDocuments();
        let productCount = await Products.countDocuments();
        let categories = await Category.find();
        let orderStatuses = ['Pending', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];

        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        let query = {};
        let recentOrders = [];
        let totalOrders = 0;

        if (categoryId && categoryId !== 'All Categories') {
            const products = await Products.find({ category: categoryId });
            const productIds = products.map(product => product._id);

            query = { 'products.productId': { $in: productIds } };
        }

        recentOrders = await Order.find(query)
            .populate('userId', 'name email')
            .populate('products.productId', 'title price')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        totalOrders = await Order.countDocuments(query); // ✅ Make sure it's calculated
        const totalPages = Math.ceil(totalOrders / limit);

        const totalSalesResult = await Order.aggregate([
            { $match: { paymentStatus: "Completed" } },
            { $group: { _id: null, totalSales: { $sum: "$totalAmount" } } }
        ]);

        const totalSales = totalSalesResult.length > 0 ? totalSalesResult[0].totalSales : 0;

        const topSellingProducts = await Products.find()
            .sort({ saleCount: -1 })
            .limit(5);

        if (isAjaxRequest) {
            return res.json({
                recentOrders,
                currentPage: page,
                totalPages
            });
        }

        return res.render('adminPanel', {
            orderCount,
            productCount,
            recentOrders,
            categories,
            orderStatuses,
            currentPage: page,
            totalPages,
            selectedCategory: categoryId || 'All Categories',
            totalSales,
            topSellingProducts,
            totalOrders // ✅ Added to fix the error
        });

    } catch (error) {
        console.error('Error filtering orders by category:', error);

        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({ error: 'Server error while filtering orders' });
        }

        return res.status(500).json({ message: 'Internal server error' });
    }
};

const getFilterByDate = async (req, res) => {
    try {
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
                start = new Date(today.getFullYear(), 0, 1);
                end = new Date(today.getFullYear(), 11, 31);
                end.setHours(23, 59, 59, 999);
                break;
            case "custom":
                if (!startDate || !endDate) {
                    return res.status(400).json({ success: false, message: "Start and end date required" });
                }
                start = new Date(startDate);
                end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                break;
            default:
                return res.status(400).json({ success: false, message: "Invalid filter type" });
        }

        // Fetch orders by date range
        const orders = await Order.find({
            createdAt: { $gte: start, $lte: end }
        })
        .populate('userId', 'name email')
        .populate({
            path: 'products.productId',
            select: 'title price'
        })
        .sort({ createdAt: -1 });

        // ✅ Calculate totalOrders count
        const totalOrders = await Order.countDocuments({
            createdAt: { $gte: start, $lte: end }
        });

        res.json({ 
            success: true, 
            orders,
            totalOrders,
            currentPage: 1,
            totalPages: Math.ceil(totalOrders / 10) // Assuming 10 items per page
        });
    } catch (error) {
        console.error("Error fetching orders by date:", error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


// Filter orders by payment/order status
const filterByStatus = async (req, res) => {
    try {
        const { status } = req.query;
        
        let query = {};
        
        if (status && status !== 'All') {
            if (status === 'Paid') {
                query.paymentStatus = 'Completed';
            } else if (status === 'Failed') {
                query.paymentStatus = 'Failed';
            } else if (status === 'Refund') {
                query.orderStatus = 'Cancelled';
            } else if (status === 'Pending') {
                query.paymentStatus = { $nin: ['Completed', 'Failed'] };
                query.orderStatus = { $ne: 'Cancelled' };
            } else {
                // Handle other statuses (if they come from orderStatuses array)
                query.orderStatus = status;
            }
        }
        
        const orders = await Order.find(query)
            .populate('userId', 'name email')
            .populate('products.productId', 'title price')
            .sort({ createdAt: -1 });
        
        const totalOrders = orders.length;
            
        res.json({ 
            success: true, 
            orders,
            totalOrders,
            currentPage: 1,
            totalPages: Math.ceil(totalOrders / 10) 
        });
    } catch (error) {
        console.error("Error filtering orders by status:", error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


const postAdmin = async (req, res) => {
    const { email, password } = req.body;
    console.log(req.body);
    

    try {
        const adminUser = await User.findOne({ email, isAdmin: true });
        // console.log(adminUser,'l00000000000000000000000000');
        
        if (!adminUser) {
            return res.status(404).json({ success: false, message: "Admin not found or unauthorized" });
        }

        const isPasswordValid = await bcrypt.compare(password, adminUser.password);
        console.log('Password validation:', isPasswordValid);

        if (!isPasswordValid) {
            console.log('password mathch alla');
            return res.status(401).json({ success: false, message: "Invalid email or password" });
            
            
        }

        req.session.admin = adminUser._id;

        return res.status(200).json({ success: true, message: "Login successful" });

    } catch (error) {
        console.error(error.message);
        return res.status(500).json({message:'internal server error'})
    }
};

const logoutAdmin = (req, res) => {
    if (req.session.user && req.session.user.isAdmin) {
      console.log("Admin is logging out");
  
    }
  
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Could not log out" });
      }
      res.clearCookie("connect.sid"); 
      res.render("adminLogin"); 
    });
  };
  const downloadOrdersPDF = async (req, res) => {
    try {
        const orders = await Order.find().populate('userId');

        const doc = new PDFDocument({ margin: 30, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="orders_report.pdf"');

        doc.pipe(res);

        doc.fontSize(20).text('Order Details Report', { align: 'center' }).moveDown(2);

        const tableHeaders = [
            { label: "Order ID", width: 80 },
            { label: "Customer", width: 120 },
            { label: "Total Amount", width: 100 },
            { label: "Payment Status", width: 100 },
            { label: "Date", width: 100 }
        ];

        let startX = 50; 
        let startY = doc.y;

        doc.fontSize(12).font("Helvetica-Bold");
        tableHeaders.forEach((header, index) => {
            doc.text(header.label, startX + (index * header.width), startY, { width: header.width, align: "center" });
        });

        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke(); 

        let totalSales = 0;
        let totalOrders = orders.length;

        doc.fontSize(10).font("Helvetica");

        orders.forEach(order => {
            doc.moveDown(0.5);

            const orderId = order.orderId || order._id.toString().slice(-6).toUpperCase();
            const customerName = order.userId ? order.userId.name || order.shippingAddress?.fullName || 'Unknown' : 'Unknown';
            const totalAmount = order.totalAmount ? `${order.totalAmount.toFixed(2)}` : '0.00';
            const paymentStatus = order.paymentStatus || 'N/A';
            const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A';

            totalSales += order.totalAmount || 0;

            let rowY = doc.y;
            doc.text(orderId, startX, rowY, { width: tableHeaders[0].width, align: "center" });
            doc.text(customerName, startX + tableHeaders[0].width, rowY, { width: tableHeaders[1].width, align: "center" });
            doc.text(totalAmount, startX + tableHeaders[0].width + tableHeaders[1].width, rowY, { width: tableHeaders[2].width, align: "center" });
            doc.text(paymentStatus, startX + tableHeaders[0].width + tableHeaders[1].width + tableHeaders[2].width, rowY, { width: tableHeaders[3].width, align: "center" });
            doc.text(orderDate, startX + tableHeaders[0].width + tableHeaders[1].width + tableHeaders[2].width + tableHeaders[3].width, rowY, { width: tableHeaders[4].width, align: "center" });

            doc.moveTo(50, doc.y + 15).lineTo(550, doc.y + 15).stroke();
            doc.moveDown(1);
        });

        doc.moveDown(2);
        doc.fontSize(12).font("Helvetica-Bold");
        doc.text(`Total Orders: ${totalOrders}`, { align: 'left' }).moveDown(0.5);
        doc.text(`Total Sales: ₹${totalSales.toFixed(2)}`, { align: 'left' }).moveDown(1);

        doc.end();
    } catch (error) {
        console.error('Error generating PDF:', error);
        if (!res.headersSent) {
            res.status(500).send('Error generating PDF');
        }
    }
};
const downloadOrdersExcel = async (req, res) => {
    try {
        const orders = await Order.find().populate('userId'); 

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Orders Report');

        worksheet.columns = [
            { header: 'Order ID', key: 'orderId', width: 20 },
            { header: 'Customer Name', key: 'customer', width: 25 },
            { header: 'Total Amount', key: 'totalAmount', width: 15 },
            { header: 'Payment Status', key: 'paymentStatus', width: 20 },
            { header: 'Date', key: 'orderDate', width: 20 },
        ];

        let totalSales = 0;
        let totalOrders = orders.length;

        orders.forEach(order => {
            totalSales += order.totalAmount || 0;
            worksheet.addRow({
                orderId: order.orderId || order._id.toString().slice(-6).toUpperCase(),
                customer: order.userId ? order.userId.name || order.shippingAddress?.fullName || 'Unknown' : 'Unknown',
                totalAmount: order.totalAmount ? `${order.totalAmount.toFixed(2)}` : '0.00',
                paymentStatus: order.paymentStatus || 'N/A',
                orderDate: order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'
            });
        });

        worksheet.addRow({});
        worksheet.addRow({ orderId: 'Total Orders:', customer: totalOrders });
        worksheet.addRow({ orderId: 'Total Sales:', customer: `${totalSales.toFixed(2)}` });

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', 'attachment; filename=orders_report.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating Excel:', error);
        if (!res.headersSent) {
            res.status(500).send('Error generating Excel report');
        }
    }
};
const getFilteredOrders = async (req, res) => {
    try {
        let { filter, startDate, endDate } = req.query;
        let query = {};
        let today = new Date();
        let start, end;

        if (filter === "daily") {
            start = new Date(today.setHours(0, 0, 0, 0));
            end = new Date(today.setHours(23, 59, 59, 999));
        } else if (filter === "weekly") {
            let firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
            start = new Date(firstDayOfWeek.setHours(0, 0, 0, 0));
            end = new Date(today.setDate(firstDayOfWeek.getDate() + 6));
        } else if (filter === "monthly") {
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        } else if (filter === "yearly") {
            start = new Date(today.getFullYear(), 0, 1);
            end = new Date(today.getFullYear(), 11, 31);
        } else if (filter === "custom" && startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
        }

        if (start && end) {
            query.createdAt = { $gte: start, $lte: end };
        }

        const orders = await Order.find(query).populate('userId');

        res.json(orders);
    } catch (error) {
        console.error("Error fetching filtered orders:", error);
       return res.status(500).json({success:false,message:'internal server error'})   }
};

module.exports = {
    adminLogin,
    postAdmin,
    getHome,
    getSalesData,
    filterCategoryList,
    getFilterByDate,
    filterByStatus,
    logoutAdmin,
    downloadOrdersPDF,
    downloadOrdersExcel,
};
