document.addEventListener('DOMContentLoaded', function() {
    setupFilterListeners();
    
    setupSearch();
    
    const filterPanel = document.querySelector('.panel-filter');
    const searchPanel = document.querySelector('.panel-search');
    
    if (filterPanel) {
        const filterToggle = document.querySelector('.js-show-filter');
        if (filterToggle) {
            filterToggle.addEventListener('click', function() {
                togglePanel(filterPanel);
            });
        }
    }
    
    if (searchPanel) {
        const searchToggle = document.querySelector('.js-show-search');
        if (searchToggle) {
            searchToggle.addEventListener('click', function() {
                togglePanel(searchPanel);
            });
        }
    }
});

function togglePanel(panel) {
    if (panel.classList.contains('dis-none')) {
        panel.classList.remove('dis-none');
    } else {
        panel.classList.add('dis-none');
    }
}

function setupFilterListeners() {
    const categoryButtons = document.querySelectorAll('.filter-tope-group button');
    categoryButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const category = this.getAttribute('data-category') || 
                            (this.getAttribute('onclick') && this.getAttribute('onclick').match(/'([^']+)'/)[1]);
            updateActiveCategory(this);
            fetchFilteredProducts({ category: category });
        });
    });
    
    const sortLinks = document.querySelectorAll('.filter-col1 a');
    sortLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sortValue = this.getAttribute('data-sort') || 
                             (this.getAttribute('onclick') && this.getAttribute('onclick').match(/'([^']*)'/)[1]);
            updateActiveSortOption(this);
            fetchFilteredProducts({ sort: sortValue });
        });
    });
    
    const priceRangeLinks = document.querySelectorAll('.filter-col2 a');
    priceRangeLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const rangeValue = this.getAttribute('data-range') || 
                              (this.getAttribute('onclick') && this.getAttribute('onclick').match(/'([^']+)'/)[1]);
            updateActivePriceRange(this);
            fetchFilteredProducts({ priceRange: rangeValue });
        });
    });
}

function setupSearch() {
    const searchInput = document.querySelector('input[name="search-product"]');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const searchValue = this.value.trim();
                fetchFilteredProducts({ search: searchValue });
            }
        });
        
        const searchButton = document.querySelector('.panel-search button');
        if (searchButton) {
            searchButton.addEventListener('click', function() {
                const searchValue = searchInput.value.trim();
                fetchFilteredProducts({ search: searchValue });
            });
        }
    }
}

function updateActiveCategory(activeButton) {
    const allCategoryButtons = document.querySelectorAll('.filter-tope-group button, .filter-tope-group a');
    allCategoryButtons.forEach(btn => {
        btn.classList.remove('how-active1');
    });
    activeButton.classList.add('how-active1');
}

function updateActiveSortOption(activeLink) {
    const allSortLinks = document.querySelectorAll('.filter-col1 a');
    allSortLinks.forEach(link => {
        link.classList.remove('filter-link-active');
    });
    activeLink.classList.add('filter-link-active');
}

function updateActivePriceRange(activeLink) {
    const allRangeLinks = document.querySelectorAll('.filter-col2 a');
    allRangeLinks.forEach(link => {
        link.classList.remove('filter-link-active');
    });
    activeLink.classList.add('filter-link-active');
}

function fetchFilteredProducts(filterParams = {}) {
    const currentUrl = new URL(window.location.href);
    const currentParams = new URLSearchParams(currentUrl.search);
    
    let params = {};
    
    for(const [key, value] of currentParams.entries()) {
        params[key] = value;
    }
    
    Object.assign(params, filterParams);
    
    Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null || params[key] === undefined) {
            delete params[key];
        }
    });
    
    const queryString = new URLSearchParams(params).toString();
    
    showLoading();
    
    fetch(`/products?${queryString}`, {
        credentials: 'include' 
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                updateProductsContainer(data.products);
                
                updateUrlParams(params);
                
                hideLoading();
            } else {
                console.error('Error fetching products:', data.message);
                hideLoading();
                showErrorMessage(`Failed to load products: ${data.message}`);
            }
        })
        .catch(error => {
            console.error('Fetch error:', error);
            hideLoading();
            showErrorMessage(`An error occurred: ${error.message}`);
        });
}

function showLoading() {
    const productsContainer = document.querySelector('.row.flex-wrap');
    if (productsContainer) {
        productsContainer.innerHTML = `
            <div class="col-12 text-center p-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="sr-only">Loading...</span>
                </div>
                <p class="mt-2">Loading products...</p>
            </div>
        `;
    }
}

function hideLoading() {
}

function showErrorMessage(message) {
    const productsContainer = document.querySelector('.row.flex-wrap');
    if (productsContainer) {
        productsContainer.innerHTML = `
            <div class="col-12 text-center p-5">
                <div class="alert alert-danger" role="alert">
                    ${message}
                </div>
            </div>
        `;
    }
}

function updateProductsContainer(products) {
    const productsContainer = document.querySelector('.row.flex-wrap');
    if (!productsContainer) return;
    
    if (!products || products.length === 0) {
        productsContainer.innerHTML = `
            <div class="col-12 text-center p-5">
                <p>No products found matching your criteria.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    products.forEach(product => {
        html += `
            <div class="col-sm-6 col-md-6 col-lg-3 p-b-35 isotope-item women">
                <div class="block2">
                    <div class="block2-pic hov-img0">
                        <img 
                            src="${product.image && product.image.length > 0 ? product.image[0] : '/images/placeholder.jpg'}"
                            alt="${product.title}"
                            class="img-fluid"
                        />
                        <a href="/show/${product._id}" class="block2-btn flex-c-m stext-103 cl2 size-102 bg0 bor2 hov-btn1 p-lr-15 trans-04">
                            Quick View
                        </a>
                    </div>
    
                    <div class="block2-txt flex-w flex-t p-t-14">
                        <div class="block2-txt-child1 flex-col-l">
                            <a href="/show/${product._id}" class="stext-104 cl4 hov-cl1 trans-04 js-name-b2 p-b-6">
                                ${product.title}
                            </a>
    
                            ${product.hasDiscount ? `
                                <!-- Discount badge - show offer type -->
                                <div class="offer-type-badge" style="background-color: ${product.offerType === 'category' ? '#6c42f5' : '#dc3545'};">
                                    ${product.offerType === 'category' ? 'CATEGORY OFFER' : 'PRODUCT OFFER'}
                                </div>
                                
                                <!-- Price display with strikethrough -->
                                <div class="price-container">
                                    <span class="original-price">
                                        ₹${Math.round(product.originalPrice).toLocaleString('en-IN')}
                                    </span>
                                    <span class="discounted-price">
                                        ₹${Math.round(product.discountedPrice).toLocaleString('en-IN')}
                                    </span>
                                </div>
                                
                                <!-- Discount information -->
                                <div class="discount-info">
                                    <span class="discount-badge">
                                        ${product.appliedOffer.discountType === 'percentage' 
                                            ? `${Math.round(product.appliedOffer.discountValue)}% OFF`
                                            : `₹${Math.round(product.appliedOffer.discountValue)} OFF`}
                                    </span>
                                    <span class="savings">
                                        (Save ₹${Math.round(product.appliedOffer.discountAmount)})
                                    </span>
                                </div>
                                
                                <!-- Offer description -->
                                <div class="offer-description">
                                    ${product.appliedOffer.description}
                                </div>
                            ` : `
                                <p class="price" style="font-weight:500; font-size: 1.9rem;">
                                    ₹${Math.round(product.originalPrice).toLocaleString('en-IN')}
                                </p>
                            `}
                        </div>
                        
                        <div class="block2-txt-child2 flex-r p-t-3">
                            <a href="#" class="btn-addwish-b2 dis-block pos-relative js-addwish-b2" data-id="${product._id}">
                                <img class="icon-heart1 dis-block trans-04" src="/asset1/images/icons/icon-heart-01.png" alt="ICON">
                                <img class="icon-heart2 dis-block trans-04 ab-t-l" src="/asset1/images/icons/icon-heart-02.png" alt="ICON">
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    productsContainer.innerHTML = html;
    
    reinitializeWishlistButtons();
}

function updateUrlParams(params) {
    const url = new URL(window.location.href);
    
    url.search = '';
    
    Object.keys(params).forEach(key => {
        if (params[key]) {
            url.searchParams.set(key, params[key]);
        }
    });
    
    window.history.pushState({}, '', url);
}

function reinitializeWishlistButtons() {
    const wishlistButtons = document.querySelectorAll('.js-addwish-b2');
    if (wishlistButtons.length > 0) {
        wishlistButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                const productId = this.getAttribute('data-id');
                
                fetch('/api/wishlist/toggle', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include', 
                    body: JSON.stringify({ productId: productId }),
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        this.classList.toggle('js-addedwish-b2');
                    } else {
                        if (data.redirectToLogin) {
                            window.location.href = '/login';
                        }
                    }
                })
                .catch(error => {
                    console.error('Error toggling wishlist:', error);
                });
            });
        });
    }
}

function categoryFilter(categoryName) {
    fetchFilteredProducts({ category: categoryName });
}

function sortByPrice(sortValue) {
    fetchFilteredProducts({ sort: sortValue });
}

function filterByPriceRange(rangeValue) {
    fetchFilteredProducts({ priceRange: rangeValue });
}

function searchValue(value) {
    fetchFilteredProducts({ search: value });
}