function searchValue(val) {
    const params = new URLSearchParams(window.location.search);
    params.set('search', val);
    params.set('page', 1); // Reset pagination when searching
    window.location.href = `/shop?${params.toString()}`;
  }
  
function categoryFilter(val) {
    const params = new URLSearchParams(window.location.search);
    
    // Preserve other filters
    const search = params.get('search');
    const sort = params.get('sort');
    const priceRange = params.get('priceRange');
    
    // Create a new params object to avoid duplicates
    const newParams = new URLSearchParams();
    
    // Set the category
    if (val) {
      newParams.set('category', encodeURIComponent(val));
    }
    
    // Preserve other parameters
    if (search) newParams.set('search', search);
    if (sort) newParams.set('sort', sort);
    if (priceRange) newParams.set('priceRange', priceRange);
    
    // Reset to page 1 when changing category
    newParams.set('page', 1);
    
    window.location.href = `/shop?${newParams.toString()}`;
  }
  
  function sortByPrice(val) {
    const params = new URLSearchParams(window.location.search);
    
    // Preserve other filters
    const category = params.get('category');
    const search = params.get('search');
    const priceRange = params.get('priceRange');
    
    // Create a new params object
    const newParams = new URLSearchParams();
    
    // Set sort parameter if it has a value
    if (val) {
      newParams.set('sort', val);
    }
    
    // Preserve other parameters
    if (category) newParams.set('category', category);
    if (search) newParams.set('search', search);
    if (priceRange) newParams.set('priceRange', priceRange);
    
    // Reset to page 1 when changing sort order
    newParams.set('page', 1);
    
    window.location.href = `/shop?${newParams.toString()}`;
  }
  
  function filterByPriceRange(range) {
    const params = new URLSearchParams(window.location.search);
    
    // Preserve other filters
    const category = params.get('category');
    const search = params.get('search');
    const sort = params.get('sort');
    
    const newParams = new URLSearchParams();
    
    if (range !== 'all') {
      newParams.set('priceRange', range);
    }
    
    if (category) newParams.set('category', category);
    if (search) newParams.set('search', search);
    if (sort) newParams.set('sort', sort);
    
    newParams.set('page', 1);
    
    window.location.href = `/shop?${newParams.toString()}`;
  }