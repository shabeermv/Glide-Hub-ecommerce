// filter.js - Enhanced with date and status filtering functions

function categoryFilter(categoryId) {
    if (categoryId && categoryId !== 'All Categories') {
        window.location.href = `/admin/orderFilterByCategory?categoryId=${categoryId}`;
    } else if (categoryId === 'All Categories') {
        window.location.href = '/admin/home';
    }
}

function filterOrdersByDate() {
    const filterType = document.getElementById("dateFilter").value;
    const startDateContainer = document.getElementById("startDateContainer");
    const endDateContainer = document.getElementById("endDateContainer");
    
    // Toggle visibility of date pickers based on selection
    if (filterType === "custom") {
        startDateContainer.classList.remove("d-none");
        endDateContainer.classList.remove("d-none");
        
        // Don't filter immediately when selecting custom - wait for dates
        if (!document.getElementById("startDate").value || !document.getElementById("endDate").value) {
            return;
        }
    } else {
        startDateContainer.classList.add("d-none");
        endDateContainer.classList.add("d-none");
    }
    
    // Get date values if custom is selected
    let startDateValue = "";
    let endDateValue = "";
    
    if (filterType === "custom") {
        startDateValue = document.getElementById("startDate").value;
        endDateValue = document.getElementById("endDate").value;
    }
    
    // Call API and update table
    fetch(`/admin/filterByDate?filter=${filterType}&startDate=${startDateValue}&endDate=${endDateValue}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateOrdersTable(data.orders);
                
                // Update pagination info if available
                if (data.totalOrders !== undefined && data.currentPage !== undefined && data.totalPages !== undefined) {
                    updatePagination(data.currentPage, data.totalPages);
                }
            } else {
                console.error("Error filtering by date:", data.message);
            }
        })
        .catch(error => console.error("Error:", error));
}

function filterByStatus(status) {
    let url = '/admin/filterByStatus?status=' + status;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateOrdersTable(data.orders);
            } else {
                console.error("Error filtering by status:", data.message);
            }
        })
        .catch(error => console.error("Error:", error));
}

function updateOrdersTable(orders) {
    const tableBody = document.getElementById('ordersTableBody');
    tableBody.innerHTML = '';

    if (orders.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center">No orders found</td></tr>`;
        return;
    }

    let totalOrdersAmount = 0;
    let totalOrdersCount = orders.length;

    orders.forEach((order, index) => {
        totalOrdersAmount += order.totalAmount || 0;
        
        const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });

        const orderId = order.orderId || (order._id ? order._id.toString().slice(-6).toUpperCase() : 'UNKNOWN');
        const customerName = order.userId && order.userId.name ? order.userId.name : 
                             (order.shippingAddress && order.shippingAddress.fullName ? 
                              order.shippingAddress.fullName : 'Unknown');
        
        const total = order.totalAmount ? order.totalAmount.toFixed(2) : '0.00';
        const paymentMethod = order.paymentMethod && order.paymentMethod.length > 0 ? 
                              order.paymentMethod[0] : 'Unknown';

        let statusBadge = '';
        if (order.paymentStatus === 'Completed') {
            statusBadge = '<span class="badge badge-pill badge-success">Paid</span>';
        } else if (order.paymentStatus === 'Failed') {
            statusBadge = '<span class="badge badge-pill badge-danger">Failed</span>';
        } else if (order.orderStatus === 'Cancelled') {
            statusBadge = '<span class="badge badge-pill badge-warning">Refund</span>';
        } else {
            statusBadge = '<span class="badge badge-pill badge-warning">Pending</span>';
        }

        tableBody.innerHTML += `
            <tr>
                <td class="text-center">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="transactionCheck${index + 2}" />
                        <label class="form-check-label" for="transactionCheck${index + 2}"></label>
                    </div>
                </td>
                <td><a href="/admin/orders/${order._id}" class="fw-bold">${orderId}</a></td>
                <td>${customerName}</td>
                <td>${orderDate}</td>
                <td>${total}</td>
                <td>${statusBadge}</td>
                <td><i class="material-icons md-payment font-xxl text-muted mr-5"></i> ${paymentMethod}</td>
                <td><a href="/admin/orders/${order._id}" class="btn btn-sm btn-info">View Details</a></td>
            </tr>
        `;
    });

    // Add total rows if needed
    tableBody.innerHTML += `
        <tr class="table-info fw-bold">
            <td colspan="4" class="text-end">Total Orders:</td>
            <td>${totalOrdersCount}</td>
            <td colspan="3"></td>
        </tr>
        <tr class="table-info fw-bold">
            <td colspan="4" class="text-end">Total Sales:</td>
            <td>₹${totalOrdersAmount.toFixed(2)}</td>
            <td colspan="3"></td>
        </tr>
    `;
}

function updatePagination(currentPage, totalPages) {
    const paginationArea = document.querySelector('.pagination-area');
    if (!paginationArea) return;
    
    let paginationHTML = `
        <nav aria-label="Page navigation">
            <ul class="pagination justify-content-start">
    `;
    
    if (currentPage > 1) {
        paginationHTML += `
            <li class="page-item">
                <a class="page-link" href="?page=${currentPage - 1}">
                    <i class="fas fa-chevron-left"></i>
                </a>
            </li>
        `;
    }
    
    for (let i = 1; i <= totalPages; i++) {
        paginationHTML += `
            <li class="page-item ${currentPage === i ? 'active' : ''}">
                <a class="page-link" href="?page=${i}">${i}</a>
            </li>
        `;
    }
    
    if (currentPage < totalPages) {
        paginationHTML += `
            <li class="page-item">
                <a class="page-link" href="?page=${currentPage + 1}">
                    <i class="fas fa-chevron-right"></i>
                </a>
            </li>
        `;
    }
    
    paginationHTML += `
            </ul>
        </nav>
    `;
    
    paginationArea.innerHTML = paginationHTML;
}