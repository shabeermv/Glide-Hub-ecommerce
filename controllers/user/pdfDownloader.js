const PDFDocument = require("pdfkit");
const Order = require("../../models/orderSchema");
const statusCode = require("../../utils/statusCodes");

const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findById(orderId)
      .populate("products.productId")
      .populate("userId");
    if (!order) {
      return res.status(statusCode.NOT_FOUND).send("Order not found");
    }

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Invoice_${order.orderId}.pdf`
    );
    res.setHeader("Content-Type", "application/pdf");

    doc.pipe(res);

    // ================= HEADER =================
    doc
      .fontSize(22)
      .fillColor("#333")
      .text("GlideHub", { align: "center" })
      .moveDown(0.3);

    doc
      .fontSize(14)
      .fillColor("#555")
      .text("INVOICE", { align: "center" })
      .moveDown(1);

    // ================= ORDER INFO =================
    doc.fontSize(12).fillColor("#000");
    doc.text(`Invoice No: ${order.orderId}`);
    doc.text(`Date: ${order.createdAt.toDateString()}`);
    doc.moveDown();

    // ================= CUSTOMER INFO =================
    doc.fontSize(12).text("Customer Details", { underline: true });
    doc.text(`Name: ${order.userId.username}`);
    doc.text(`Email: ${order.userId.email}`);
    doc.moveDown();

    // ================= SHIPPING INFO =================
    const shipping = order.shippingAddress;
    doc.fontSize(12).text("Shipping Address", { underline: true });
    doc.text(`${shipping.fullName}`);
    doc.text(`${shipping.address}`);
    doc.text(`${shipping.city}, ${shipping.state}, ${shipping.postalCode}`);
    doc.text(`${shipping.country}`);
    doc.text(`Phone: ${shipping.phone}`);
    doc.moveDown();

    // ================= PRODUCTS TABLE =================
    doc.fontSize(12).text("Products Ordered", { underline: true }).moveDown(0.5);

    // Column positions (absolute X coords)
    const startX = 50;
    const itemX = startX;
    const sizeX = 250;
    const qtyX = 330;
    const priceX = 400;
    const totalX = 480;
    let y = doc.y;

    // Table Header
    doc.font("Helvetica-Bold");
    doc.text("Item", itemX, y);
    doc.text("Size", sizeX, y);
    doc.text("Qty", qtyX, y);
    doc.text("Price", priceX, y, { width: 60, align: "right" });
    doc.text("Total", totalX, y, { width: 80, align: "right" });
    y += 20;
    doc.moveTo(startX, y - 5).lineTo(550, y - 5).stroke(); // header underline
    doc.font("Helvetica");

    let subtotal = 0;
    order.products.forEach((item) => {
      const lineTotal = item.price * item.quantity;
      subtotal += lineTotal;

      doc.text(item.productId.title, itemX, y, { width: 180 });
      doc.text(item.size || "-", sizeX, y);
      doc.text(item.quantity.toString(), qtyX, y, { width: 40, align: "center" });
      doc.text(`₹${item.price.toFixed(2)}`, priceX, y, { width: 60, align: "right" });
      doc.text(`₹${lineTotal.toFixed(2)}`, totalX, y, { width: 80, align: "right" });

      y += 20;
    });

    doc.moveDown(2);
    y = doc.y;

    // ================= TOTALS =================
    doc.font("Helvetica-Bold");
    doc.text("Subtotal", priceX, y, { width: 80, align: "right" });
    doc.text(`₹${subtotal.toFixed(2)}`, totalX, y, { width: 80, align: "right" });
    y += 20;

    if (order.couponDiscount) {
      doc.text("Discount", priceX, y, { width: 80, align: "right" });
      doc.text(`-₹${order.couponDiscount.toFixed(2)}`, totalX, y, { width: 80, align: "right" });
      y += 20;
    }

    doc.text("Grand Total", priceX, y, { width: 80, align: "right" });
    doc.text(`₹${order.totalAmount.toFixed(2)}`, totalX, y, { width: 80, align: "right" });

    y += 40;
    doc.font("Helvetica");
    doc.text(`Payment Method: ${order.paymentMethod}`, startX, y);
    doc.text(`Order Status: ${order.orderStatus}`, startX, y + 15);

    // ================= FOOTER =================
    doc.moveDown(5);
    doc.fontSize(10).fillColor("#777").text(
      "Thank you for shopping with GlideHub!\nThis is a computer-generated invoice and does not require a signature.",
      { align: "center" }
    );

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to generate invoice");
  }
};

module.exports = { downloadInvoice };
