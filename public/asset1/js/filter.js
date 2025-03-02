function categoryFilter(categoryId) {
    if (categoryId) {
        window.location.href = `/admin/orderFilterByCategory?categoryId=${categoryId}`;
    } else {
        window.location.href = '/admin/dashboard';
    }
}

function filterOrdersByDate() {
    let selectedValue = document.getElementById("dateFilter").value;
    let startDateContainer = document.getElementById("startDateContainer");
    let endDateContainer = document.getElementById("endDateContainer");
    let startDate = document.getElementById("startDate").value;
    let endDate = document.getElementById("endDate").value;

    if (selectedValue === "custom") {
        startDateContainer.classList.remove("d-none");
        endDateContainer.classList.remove("d-none");

        if (startDate && endDate) {
            fetchOrdersByDate("custom", startDate, endDate);
        }
    } else {
        startDateContainer.classList.add("d-none");
        endDateContainer.classList.add("d-none");
        fetchOrdersByDate(selectedValue);
    }
}

function fetchOrdersByDate(filterType, startDate = null, endDate = null) {
    let url = `/admin/filterByDate?filter=${filterType}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateOrdersTable(data.orders);
            } else {
                console.error("Error fetching orders:", data.message);
            }
        })
        .catch(error => console.error("Error fetching orders:", error));
}

function updateOrdersTable(orders) {
    const tableBody = document.querySelector('table.table tbody');
    tableBody.innerHTML = '';

    if (orders.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center">No orders found</td></tr>`;
        return;
    }

    orders.forEach(order => {
        const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });

        const orderId = order.orderId || order._id.toString().slice(-6).toUpperCase();
        const customerName = order.userId ? order.userId.name || 'Unknown' : 'Unknown';
        const total = order.totalAmount ? order.totalAmount.toFixed(2) : '0.00';
        const paymentMethod = order.paymentMethod && order.paymentMethod.length > 0 ? order.paymentMethod[0] : 'Unknown';

        let statusBadge = order.orderStatus === 'Completed' ? 
            '<span class="badge bg-success">Paid</span>' :
            order.orderStatus === 'Failed' ? 
            '<span class="badge bg-danger">Failed</span>' :
            '<span class="badge bg-warning">Pending</span>';

        tableBody.innerHTML += `
            <tr>
                <td><a href="/admin/order/${order._id}" class="fw-bold">#${orderId}</a></td>
                <td>${customerName}</td>
                <td>${orderDate}</td>
                <td>$${total}</td>
                <td>${statusBadge}</td>
                <td><i class="material-icons md-payment font-xxl text-muted mr-5"></i> ${paymentMethod}</td>
                <td><a href="/admin/order/details/${order._id}" class="btn btn-xs"> View details</a></td>
            </tr>
        `;
    });
}
