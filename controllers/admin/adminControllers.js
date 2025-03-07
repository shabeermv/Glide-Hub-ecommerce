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

            const totalOrders = await Order.countDocuments();
            const totalPages = Math.ceil(totalOrders / limit);

            return res.render('adminPanel', { 
                orderCount, 
                productCount, 
                recentOrders,
                categories,
                orderStatuses,
                currentPage: page,
                totalPages,
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
            
        totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);
        
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
            selectedCategory: categoryId || 'All Categories'
        });
        
    } catch (error) {
        console.error('Error filtering orders by category:', error);
        
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({ error: 'Server error while filtering orders' });
        }
        
        next(error)
    }
};

const getFilterByDate=async(req,res)=>{
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

        const orders = await Order.find({
            createdAt: { $gte: start, $lte: end }
        })
        .populate('userId', 'name email')
        .populate('products.productId', 'title price')
        .sort({ createdAt: -1 });

        res.json({ success: true, orders });
    } catch (error) {
        console.error("Error fetching orders by date:", error);
        next(error)    }
}

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
        next(error)    }
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

        const doc = new PDFDocument({ margin: 30 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="orders.pdf"');

        doc.pipe(res); 

        doc.fontSize(20).text('Order Details Report', { align: 'center' }).moveDown(2);

        doc.fontSize(12).text('Order ID', 50, doc.y, { continued: true })
            .text('Customer', 150, doc.y, { continued: true })
            .text('Total Amount', 300, doc.y, { continued: true })
            .text('Payment Status', 400, doc.y, { continued: true })
            .text('Date', 500, doc.y)
            .moveDown();

        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke(); 

        orders.forEach(order => {
            const orderId = order.orderId || order._id.toString().slice(-6).toUpperCase();
            const customerName = order.userId ? order.userId.name || order.shippingAddress?.fullName || 'Unknown' : 'Unknown';
            const totalAmount = order.totalAmount ? `$${order.totalAmount.toFixed(2)}` : '$0.00';
            const paymentStatus = order.paymentStatus || 'N/A';
            const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A';

            doc.moveDown();
            doc.text(orderId, 50, doc.y, { continued: true })
                .text(customerName, 150, doc.y, { continued: true })
                .text(totalAmount, 300, doc.y, { continued: true })
                .text(paymentStatus, 400, doc.y, { continued: true })
                .text(orderDate, 500, doc.y);
        });

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

        orders.forEach(order => {
            worksheet.addRow({
                orderId: order.orderId || order._id.toString().slice(-6).toUpperCase(),
                customer: order.userId ? order.userId.name || order.shippingAddress?.fullName || 'Unknown' : 'Unknown',
                totalAmount: order.totalAmount ? `$${order.totalAmount.toFixed(2)}` : '$0.00',
                paymentStatus: order.paymentStatus || 'N/A',
                orderDate: order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'
            });
        });

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', 'attachment; filename=orders.xlsx');

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
        next(error)    }
};

module.exports = {
    adminLogin,
    postAdmin,
    getHome,
    filterCategoryList,
    getFilterByDate,
    logoutAdmin,
    downloadOrdersPDF,
    downloadOrdersExcel,
};
