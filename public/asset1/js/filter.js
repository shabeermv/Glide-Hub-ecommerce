// filter.js - Enhanced with date and status filtering functions

function categoryFilter(categoryId) {
    if (categoryId && categoryId !== 'All Categories') {
        window.location.href = `/admin/orderFilterByCategory?categoryId=${categoryId}`;
    } else if (categoryId === 'All Categories') {
        window.location.href = '/admin/home';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Initialize date filter event listener
    const dateFilterElement = document.getElementById("dateFilter");
    if (dateFilterElement) {
        dateFilterElement.addEventListener('change', filterOrdersByDate);
    }
    
    // Set default values for date filters
    const today = new Date();
    const formattedToday = formatDateForInput(today);
    
    const endDateInput = document.getElementById("endDate");
    if (endDateInput) {
        endDateInput.value = formattedToday;
    }
    
    // Set start date to 30 days ago by default
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const formattedThirtyDaysAgo = formatDateForInput(thirtyDaysAgo);
    
    const startDateInput = document.getElementById("startDate");
    if (startDateInput) {
        startDateInput.value = formattedThirtyDaysAgo;
    }
    
    // Initialize category filter if present on the page
    const categoryFilterElement = document.getElementById("categoryFilter");
    if (categoryFilterElement) {
        // Use the existing categoryFilter function
        categoryFilterElement.addEventListener("change", function() {
            categoryFilter(this.value);
        });
    }
    
    // Initialize apply filter button
    const applyFilterBtn = document.getElementById("applyFilterBtn");
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener("click", applyDateFilter);
    }
});

// Helper function to format dates consistently for input elements
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Helper function to format dates for API requests
function formatDateForAPI(dateString) {
    if (!dateString) return "";
    
    // Ensure consistent date format for API: YYYY-MM-DD
    const date = new Date(dateString);
    return formatDateForInput(date);
}

function filterOrdersByDate() {
    const filterType = document.getElementById("dateFilter").value;
    const startDateContainer = document.getElementById("startDateContainer");
    const endDateContainer = document.getElementById("endDateContainer");
    const applyFilterContainer = document.getElementById("applyFilterContainer");
    
    // Toggle visibility of date pickers based on selection
    if (filterType === "custom") {
        startDateContainer.classList.remove("d-none");
        endDateContainer.classList.remove("d-none");
        applyFilterContainer.classList.remove("d-none");
        
        // Don't filter immediately when selecting custom - wait for the button click
        return;
    } else {
        startDateContainer.classList.add("d-none");
        endDateContainer.classList.add("d-none");
        applyFilterContainer.classList.add("d-none");
        
        // Apply filter immediately for non-custom options
        applyDateFilter();
    }
}

function applyDateFilter() {
    const filterType = document.getElementById("dateFilter").value;
    
    let startDateValue = "";
    let endDateValue = "";

    if (filterType === "custom") {
        const startDateInput = document.getElementById("startDate");
        const endDateInput = document.getElementById("endDate");
        
        startDateValue = startDateInput ? startDateInput.value : "";
        endDateValue = endDateInput ? endDateInput.value : "";

        if (!startDateValue || !endDateValue) {
            alert("Please select both start and end dates.");
            return;
        }

        // Parse dates for comparison
        const startDate = new Date(startDateValue);
        const endDate = new Date(endDateValue);
        
        if (startDate > endDate) {
            alert("Start date cannot be after end date.");
            return;
        }
        
        // Format dates consistently for API
        startDateValue = formatDateForAPI(startDateValue);
        endDateValue = formatDateForAPI(endDateValue);
        
        // Log the dates for debugging
        console.log("Custom date range selected:", startDateValue, "to", endDateValue);
    }

    // Show loading state
    const tableBody = document.getElementById("ordersTableBody");
    if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="8" class="text-center">Loading...</td></tr>';
    }

    // Build the URL with correct query parameters
    const url = `/admin/filterByDate?filter=${encodeURIComponent(filterType)}&startDate=${encodeURIComponent(startDateValue)}&endDate=${encodeURIComponent(endDateValue)}&orderStatus=Delivered`;
    
    // Log the URL for debugging
    console.log("Fetching URL:", url);
    
    // Make the API call
    fetch(url)
        .then(response => {
            console.log("Response status:", response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Received data:", data);
            console.log("Number of orders:", data.orders ? data.orders.length : 0);
            
            if (data.success) {
                updateOrdersTable(data.orders, data.totalOrders);

                if (data.totalOrders !== undefined && data.currentPage !== undefined && data.totalPages !== undefined) {
                    updatePagination(data.currentPage, data.totalPages);
                }
            } else {
                console.error("Error filtering by date:", data.message);
                alert("Error: " + (data.message || "Failed to filter orders"));
                if (tableBody) {
                    tableBody.innerHTML = '<tr><td colspan="8" class="text-center">No orders found</td></tr>';
                }
            }
        })
        .catch(error => {
            console.error("Error:", error);
            alert("An error occurred while filtering orders.");
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="8" class="text-center">No delivered orders found</td></tr>';
            }
        });
}

// Function to update the orders table with filtered data
function updateOrdersTable(orders, totalOrders) {
    const tableBody = document.getElementById("ordersTableBody");
    if (!tableBody) return;
    
    if (!orders || orders.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="text-center">No orders found</td></tr>';
        return;
    }
    
    let html = '';
    let totalAmount = 0;
    
    orders.forEach((order, index) => {
        totalAmount += order.totalAmount || 0;
        
        const orderStatus = order.orderStatus || 'Unknown';
        
        // Only show delivered orders
        if (orderStatus.toLowerCase() !== 'delivered') {
            return;
        }
        
        let paymentStatusBadge = '';
        if (order.paymentStatus && order.paymentStatus.toLowerCase() === 'completed') {
            paymentStatusBadge = '<span class="badge badge-pill badge-success">Paid</span>';
        } else if (order.paymentStatus && order.paymentStatus.toLowerCase() === 'failed') {
            paymentStatusBadge = '<span class="badge badge-pill badge-danger">Failed</span>';
        } else if (order.orderStatus && order.orderStatus.toLowerCase() === 'cancelled') {
            paymentStatusBadge = '<span class="badge badge-pill badge-warning">Refund</span>';
        } else {
            paymentStatusBadge = '<span class="badge badge-pill badge-warning">Pending</span>';
        }
        
        const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
        });
        
        const billingName = order.userId && order.userId.name 
            ? order.userId.name 
            : (order.shippingAddress && order.shippingAddress.fullName 
                ? order.shippingAddress.fullName 
                : 'Unknown');
        
        const orderId = order.orderId || (order._id ? order._id.toString().slice(-6).toUpperCase() : 'UNKNOWN');
        const paymentMethod = order.paymentMethod && order.paymentMethod.length > 0 
            ? order.paymentMethod[0] 
            : 'Unknown';
            
        html += `
            <tr>
                <td class="text-center">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="transactionCheck${index + 2}" />
                        <label class="form-check-label" for="transactionCheck${index + 2}"></label>
                    </div>
                </td>
                <td>
                    <a href="/admin/orders/${order._id}" class="fw-bold">${orderId}</a>
                </td>
                <td>${billingName}</td>
                <td>${orderDate}</td>
                <td>${order.totalAmount ? order.totalAmount.toFixed(2) : '0.00'}</td>
                <td>
                    <span class="badge badge-pill badge-success">Delivered</span>
                </td>
                <td>
                    <i class="material-icons md-payment font-xxl text-muted mr-5"></i> 
                    ${paymentMethod}
                </td>
                <td>
                    <a href="/admin/orders/${order._id}" class="btn btn-sm btn-info">
                        View Details
                    </a>
                </td>
            </tr>
        `;
    });
    
    // Add summary rows
    html += `
        <tr class="table-info fw-bold">
            <td colspan="4" class="text-end">Total Delivered Orders:</td>
            <td>${totalOrders || orders.length}</td>
            <td colspan="3"></td>
        </tr>
        <tr class="table-info fw-bold">
            <td colspan="4" class="text-end">Total Sales from Delivered Orders:</td>
            <td>₹${totalAmount.toFixed(2)}</td>
            <td colspan="3"></td>
        </tr>
    `;
    
    tableBody.innerHTML = html;
}

// Function to update the pagination controls
function updatePagination(currentPage, totalPages) {
    const paginationArea = document.querySelector('.pagination-area');
    if (!paginationArea) return;
    
    const paginationList = paginationArea.querySelector('ul.pagination');
    if (!paginationList) return;
    
    let html = '';
    
    // Previous button
    if (currentPage > 1) {
        html += `
            <li class="page-item">
                <a class="page-link" href="?page=${currentPage - 1}">
                    <i class="fas fa-chevron-left"></i>
                </a>
            </li>
        `;
    }
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        html += `
            <li class="page-item ${currentPage === i ? 'active' : ''}">
                <a class="page-link" href="?page=${i}">${i}</a>
            </li>
        `;
    }
    
    // Next button
    if (currentPage < totalPages) {
        html += `
            <li class="page-item">
                <a class="page-link" href="?page=${currentPage + 1}">
                    <i class="fas fa-chevron-right"></i>
                </a>
            </li>
        `;
    }
    
    paginationList.innerHTML = html;
}