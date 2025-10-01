function searchValue(val) {
    const params = new URLSearchParams(window.location.search);
    params.set('search', val);
    params.set('page', 1); 
    window.location.href = `/shop?${params.toString()}`;
  }
  
function categoryFilter(val) {
    const params = new URLSearchParams(window.location.search);
    
    
    const search = params.get('search');
    const sort = params.get('sort');
    const priceRange = params.get('priceRange');
    
    
    const newParams = new URLSearchParams();
    
    
    if (val) {
      newParams.set('category', encodeURIComponent(val));
    }
    
    
    if (search) newParams.set('search', search);
    if (sort) newParams.set('sort', sort);
    if (priceRange) newParams.set('priceRange', priceRange);
    
    
    newParams.set('page', 1);
    
    window.location.href = `/shop?${newParams.toString()}`;
  }
  
  function sortByPrice(val) {
    const params = new URLSearchParams(window.location.search);
    
    
    const category = params.get('category');
    const search = params.get('search');
    const priceRange = params.get('priceRange');
    
    
    const newParams = new URLSearchParams();
    
    
    if (val) {
      newParams.set('sort', val);
    }
    
    
    if (category) newParams.set('category', category);
    if (search) newParams.set('search', search);
    if (priceRange) newParams.set('priceRange', priceRange);
    
    
    newParams.set('page', 1);
    
    window.location.href = `/shop?${newParams.toString()}`;
  }
  
  function filterByPriceRange(range) {
    const params = new URLSearchParams(window.location.search);
    
    
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