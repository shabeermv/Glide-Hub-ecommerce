function searchValue(val) {
    const params = new URLSearchParams(window.location.search);
    params.set('search', val);
    window.location.href = `/shop?${params.toString()}`;
}

function categoryFilter(val) {
    const params = new URLSearchParams(window.location.search);
    params.delete('category');
    if (val) params.append('category', val);
    window.location.href = `/shop?${params.toString()}`;
}
function sortByPrice(val) {
    const params = new URLSearchParams(window.location.search);
    if (val) {
        params.set('sort', val);
    } else {
        params.delete('sort');
    }
    window.location.href = `/shop?${params.toString()}`;
}

function filterByPriceRange(range) {
    const params = new URLSearchParams(window.location.search);
    
    // Preserve existing parameters
    const category = params.get('category');
    const search = params.get('search');
    const sort = params.get('sort');
    
    // Clear and set parameters
    params.delete('priceRange');
    if (range !== 'all') {
        params.set('priceRange', range);
    }
    
    // Add back preserved parameters
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    if (sort) params.set('sort', sort);
    
    window.location.href = `/shop?${params.toString()}`;
}