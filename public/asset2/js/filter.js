// Main filter handling function
function applyFilters() {
    // Get all filter values
    const categorySelect = document.querySelector('.custom_select select');
    const dateFilterSelect = document.getElementById('dateFilter');
    const statusSelect = document.querySelector('.custom_select:nth-child(3) select');
    
    const categoryId = categorySelect ? categorySelect.value : 'all';
    const dateFilter = dateFilterSelect ? dateFilterSelect.value : 'all';
    const status = statusSelect ? statusSelect.value : 'all';
    
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    // Build query string
    let queryParams = new URLSearchParams();
    
    if (categoryId && categoryId !== 'all') {
        queryParams.set('category', categoryId);
    }
    
    if (status && status !== 'all') {
        queryParams.set('status', status);
    }
    
    if (dateFilter && dateFilter !== 'all') {
        queryParams.set('dateFilter', dateFilter);
        
        if (dateFilter === 'custom' && startDate) {
            queryParams.set('startDate', startDate);
        }
        
        if (dateFilter === 'custom' && endDate) {
            queryParams.set('endDate', endDate);
        }
    }
    
    // Add current page
    queryParams.set('page', '1'); // Reset to first page when filtering
    
    // Redirect to filtered URL
    window.location.href = `?${queryParams.toString()}`;
}

// Update orders table via AJAX
function updateOrdersTable(orders) {
    const tableBody = document.querySelector('table.table tbody');
    if (!tableBody || !orders) return;
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    if (orders.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = '<td colspan="8" class="text-center">No orders found</td>';
        tableBody.appendChild(emptyRow);
        return;
    }
    
    // Add new rows
    orders.forEach((order, index) => {
        const row = document.createElement('tr');
        
        // Format date
        const orderDate = new Date(order.createdAt);
        const formattedDate = orderDate.toLocaleDateString('en-US', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
        });
        
        // Determine name to display
        const name = order.userId 
            ? (order.userId.username || order.shippingAddress.fullName)
            : (order.guestEmail || order.shippingAddress.fullName || 'Unknown');
        
        // Determine payment status class and text
        let paymentStatusClass = 'badge-soft-warning';
        let paymentStatusText = 'Pending';
        
        if (order.paymentStatus === 'Completed') {
            paymentStatusClass = 'badge-soft-success';
            paymentStatusText = 'Paid';
        } else if (order.paymentStatus === 'Failed') {
            paymentStatusClass = 'badge-soft-danger';
            paymentStatusText = 'Failed';
        } else if (order.orderStatus === 'Cancelled') {
            paymentStatusClass = 'badge-soft-warning';
            paymentStatusText = 'Refund';
        }
        
        // Create row HTML
        row.innerHTML = `
            <td class="text-center">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="transactionCheck${index + 2}" />
                    <label class="form-check-label" for="transactionCheck${index + 2}"></label>
                </div>
            </td>
            <td><a href="/admin/order/${order._id}" class="fw-bold">#${order.orderId || order._id.toString().slice(-6).toUpperCase()}</a></td>
            <td>${name}</td>
            <td>${formattedDate}</td>
            <td>$${order.totalAmount ? order.totalAmount.toFixed(2) : '0.00'}</td>
            <td>
                <span class="badge badge-pill ${paymentStatusClass}">${paymentStatusText}</span>
            </td>
            <td><i class="material-icons md-payment font-xxl text-muted mr-5"></i> ${order.paymentMethod && order.paymentMethod.length > 0 ? order.paymentMethod[0] : 'Unknown'}</td>
            <td>
                <a href="/admin/order/details/${order._id}" class="btn btn-xs"> View details</a>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Fetch orders using AJAX
function fetchOrdersWithAjax() {
    // Get all filter values
    const categorySelect = document.querySelector('.custom_select select');
    const dateFilterSelect = document.getElementById('dateFilter');
    const statusSelect = document.querySelector('.custom_select:nth-child(3) select');
    
    const categoryId = categorySelect ? categorySelect.value : 'all';
    const dateFilter = dateFilterSelect ? dateFilterSelect.value : 'all';
    const status = statusSelect ? statusSelect.value : 'all';
    
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    // Current page
    const currentPage = new URLSearchParams(window.location.search).get('page') || 1;
    
    // Build query string
    let queryParams = new URLSearchParams();
    
    if (categoryId && categoryId !== 'all') {
        queryParams.set('category', categoryId);
    }
    
    if (status && status !== 'all') {
        queryParams.set('status', status);
    }
    
    if (dateFilter && dateFilter !== 'all') {
        queryParams.set('dateFilter', dateFilter);
        
        if (dateFilter === 'custom' && startDate) {
            queryParams.set('startDate', startDate);
        }
        
        if (dateFilter === 'custom' && endDate) {
            queryParams.set('endDate', endDate);
        }
    }
    
    queryParams.set('page', currentPage);
    queryParams.set('format', 'json');
    
    // Fetch data
    fetch(`/admin/orders?${queryParams.toString()}`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.orders) {
                updateOrdersTable(data.orders);
                updatePagination(data.currentPage, data.totalPages, queryParams);
            }
        })
        .catch(error => console.error('Error fetching orders:', error));
}

// Update pagination links
function updatePagination(currentPage, totalPages, queryParams) {
    const paginationContainer = document.querySelector('.pagination');
    if (!paginationContainer) return;
    
    // Clear existing pagination
    paginationContainer.innerHTML = '';
    
    // Previous page link
    if (currentPage > 1) {
        queryParams.set('page', parseInt(currentPage) - 1);
        const prevLink = document.createElement('li');
        prevLink.className = 'page-item';
        prevLink.innerHTML = `
            <a class="page-link" href="?${queryParams.toString()}">
                <i class="fas fa-chevron-left"></i>
            </a>
        `;
        paginationContainer.appendChild(prevLink);
    }
    
    // Page number links
    for (let i = 1; i <= totalPages; i++) {
        queryParams.set('page', i);
        const pageLink = document.createElement('li');
        pageLink.className = `page-item ${currentPage == i ? 'active' : ''}`;
        pageLink.innerHTML = `
            <a class="page-link" href="?${queryParams.toString()}">${i}</a>
        `;
        paginationContainer.appendChild(pageLink);
    }
    
    // Next page link
    if (currentPage < totalPages) {
        queryParams.set('page', parseInt(currentPage) + 1);
        const nextLink = document.createElement('li');
        nextLink.className = 'page-item';
        nextLink.innerHTML = `
            <a class="page-link" href="?${queryParams.toString()}">
                <i class="fas fa-chevron-right"></i>
            </a>
        `;
        paginationContainer.appendChild(nextLink);
    }
}

// Attach event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Category filter
    const categorySelect = document.querySelector('.custom_select select');
    if (categorySelect) {
        categorySelect.addEventListener('change', applyFilters);
    }
    
    // Date filter
    const dateFilterSelect = document.getElementById('dateFilter');
    if (dateFilterSelect) {
        dateFilterSelect.addEventListener('change', function() {
            const selectedValue = this.value;
            const startDateContainer = document.getElementById('startDateContainer');
            const endDateContainer = document.getElementById('endDateContainer');
            
            if (selectedValue === 'custom') {
                startDateContainer.classList.remove('d-none');
                endDateContainer.classList.remove('d-none');
            } else {
                startDateContainer.classList.add('d-none');
                endDateContainer.classList.add('d-none');
                applyFilters();
            }
        });
    }
    
    const statusSelect = document.querySelector('.custom_select:nth-child(3) select');
    if (statusSelect) {
        statusSelect.addEventListener('change', applyFilters);
    }
    
    const startDateInput = document.getElementById('startDate');
    if (startDateInput) {
        startDateInput.addEventListener('change', function() {
            if (document.getElementById('endDate').value) {
                applyFilters();
            }
        });
    }
    
    const endDateInput = document.getElementById('endDate');
    if (endDateInput) {
        endDateInput.addEventListener('change', function() {
            if (document.getElementById('startDate').value) {
                applyFilters();
            }
        });
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    
    if (categorySelect && urlParams.has('category')) {
        categorySelect.value = urlParams.get('category');
    }
    
    if (dateFilterSelect && urlParams.has('dateFilter')) {
        dateFilterSelect.value = urlParams.get('dateFilter');
        
        if (urlParams.get('dateFilter') === 'custom') {
            const startDateContainer = document.getElementById('startDateContainer');
            const endDateContainer = document.getElementById('endDateContainer');
            
            if (startDateContainer) startDateContainer.classList.remove('d-none');
            if (endDateContainer) endDateContainer.classList.remove('d-none');
            
            if (startDateInput && urlParams.has('startDate')) {
                startDateInput.value = urlParams.get('startDate');
            }
            
            if (endDateInput && urlParams.has('endDate')) {
                endDateInput.value = urlParams.get('endDate');
            }
        }
    }
    
    if (statusSelect && urlParams.has('status')) {
        statusSelect.value = urlParams.get('status');
    }
});