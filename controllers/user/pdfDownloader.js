const PDFDocument = require("pdfkit");
const Order = require("../../models/orderSchema");
const statusCode = require("../../utils/statusCodes")

const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.id;
    console.log("order id gott.....", orderId);

    const order = await Order.findById(orderId)
      .populate("products.productId")
      .populate("userId");
    if (!order) {
      return res.status(statusCode.NOT_FOUND).send("Order not found");
    }

    // Create a new PDF document
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Invoice_${order.orderId}.pdf`
    );
    res.setHeader("Content-Type", "application/pdf");

    doc.pipe(res);

    // Add store info
    doc.fontSize(20).text("GlideHub", { align: "center" });
    doc.fontSize(12).text("Invoice", { align: "center" });
    doc.moveDown();

    doc.fontSize(12).text(`Order ID: ${order.orderId}`);
    doc.text(`Date: ${order.createdAt.toDateString()}`);
    doc.text(`Customer: ${order.userId.username}`);
    doc.text(`Email: ${order.userId.email}`);
    doc.moveDown();

    // Shipping Info
    const shipping = order.shippingAddress;
    doc.text("Shipping Address:");
    doc.text(`${shipping.fullName}, ${shipping.address}`);
    doc.text(`${shipping.city}, ${shipping.state}, ${shipping.postalCode}`);
    doc.text(`${shipping.country}`);
    doc.text(`Phone: ${shipping.phone}`);
    doc.moveDown();

    doc.text("Products Ordered:", { underline: true });
    order.products.forEach((item, idx) => {
      doc.text(
        `${idx + 1}. ${item.productId.title} - ₹${item.price.toFixed(2)} x ${
          item.quantity
        } (Size: ${item.size})`
      );
    });
    doc.moveDown();

    // Total
    doc.text(`Total Amount: ₹${order.totalAmount.toFixed(2)}`, { bold: true });
    if (order.couponDiscount) {
      doc.text(`Coupon Discount: ₹${order.couponDiscount.toFixed(2)}`);
    }
    doc.text(`Payment Method: ${order.paymentMethod}`);
    doc.text(`Order Status: ${order.orderStatus}`);

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to generate invoice");
  }
};

module.exports = { downloadInvoice };
