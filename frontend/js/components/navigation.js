async function checkAuthStatus(storeId, container) {
  if (typeof AuthManager !== 'undefined') {
    AuthManager.initAuthUI(container.id, storeId);
  }
}

async function createAdminNav(storeId, activePage = 'prices') {
  const nav = document.createElement('nav');
  nav.className = 'admin-nav';
  
  // Get auth status first to determine what to show
  let authStatus = { hasAuth: false, isAuthenticated: false, authLevel: null };
  if (typeof AuthManager !== 'undefined') {
    try {
      authStatus = await AuthManager.getAuthStatus(storeId);
    } catch (error) {
      console.error('Error getting auth status:', error);
    }
  }
  
  const storeInfo = document.createElement('div');
  storeInfo.className = 'store-info';
  
  const storeLogo = document.createElement('img');
  storeLogo.src = '/assets/icons/logo.png';
  storeLogo.alt = 'Store Logo';
  storeLogo.onerror = function() {
    this.style.display = 'none';
  };
  
  const storeIdSpan = document.createElement('span');
  storeIdSpan.className = 'store-id';
  storeIdSpan.textContent = `Store #${storeId}`;
  
  // Add auth mode indicator
  if (authStatus.isAuthenticated) {
    const indicator = document.createElement('span');
    indicator.className = 'admin-mode-indicator';
    
    if (authStatus.isDemo) {
      indicator.textContent = authStatus.authLevel === 'admin' ? 'DEMO ADMIN' : 'DEMO';
      indicator.style.background = '#17a2b8'; // Teal for demo
    } else if (authStatus.authLevel === 'admin') {
      indicator.textContent = 'ADMIN';
      indicator.style.background = '#f093fb'; // Purple for admin
    }
    
    if (indicator.textContent) {
      storeIdSpan.appendChild(indicator);
    }
  }
  
  const authDropdown = document.createElement('div');
  authDropdown.className = 'auth-dropdown';
  authDropdown.id = `auth-dropdown-${storeId}-${Date.now()}`;
  
  storeInfo.appendChild(storeLogo);
  storeInfo.appendChild(storeIdSpan);
  storeInfo.appendChild(authDropdown);
  
  // Only show navbar at all if store has auth configured
  if (!authStatus.hasAuth) {
    // No auth configured - return empty div (no navbar)
    return document.createElement('div');
  }
  
  nav.appendChild(storeInfo);
  
  // Show nav items based on authentication status
  const navItems = document.createElement('ul');
  navItems.className = 'nav-items';
  
  // Define nav items based on auth level
  const userItems = [
    { id: 'wizard', label: 'Wizard', href: '/wizard' },
    { id: 'packing', label: 'Packing', href: '/packing' },
    { id: 'prices', label: 'Price Table', href: '/prices' }
  ];
  
  const adminItems = [
    { id: 'wizard', label: 'Wizard', href: '/wizard' },
    { id: 'packing', label: 'Packing', href: '/packing' },
    { id: 'prices', label: 'Edit Prices', href: '/prices' },
    { id: 'import', label: 'Import', href: '/import' },
    { id: 'floorplan', label: 'Floorplan', href: '/floorplan' },
    { id: 'settings', label: 'Settings', href: '/settings' }
  ];
  
  // Filter items based on auth status and level
  let items;
  if (authStatus.isAuthenticated) {
    if (authStatus.authLevel === 'admin') {
      // Admin - show all items
      items = adminItems;
    } else {
      // User - show limited items
      items = userItems;
    }
  } else {
    // Not authenticated - show no nav items (they should be redirected to login)
    items = [];
  }
  
  items.forEach(item => {
    const li = document.createElement('li');
    li.className = `nav-item${activePage === item.id ? ' active' : ''}`;
    
    const a = document.createElement('a');
    a.href = item.href;
    a.textContent = item.label;
    
    li.appendChild(a);
    navItems.appendChild(li);
  });
  
  nav.appendChild(navItems);
  
  
  const mobileMenuToggle = document.createElement('button');
  mobileMenuToggle.className = 'mobile-menu-toggle';
  mobileMenuToggle.textContent = '☰';
  mobileMenuToggle.addEventListener('click', () => {
    nav.classList.toggle('nav-expanded');
  });
  
  nav.appendChild(mobileMenuToggle);
  
  // Add the CSS for the navigation
  const styleExists = document.getElementById('admin-nav-style');
  if (!styleExists) {
    const style = document.createElement('style');
    style.id = 'admin-nav-style';
    style.textContent = `
      .admin-nav {
        display: flex;
        align-items: center;
        background: #f8f9fa;
        padding: 10px 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .nav-items {
        display: flex;
        list-style: none;
        margin: 0 0 0 40px;
        padding: 0;
      }
      
      .nav-item {
        margin: 0 10px;
      }
      
      .nav-item a {
        text-decoration: none;
        color: #333;
        padding: 5px 10px;
        border-radius: 4px;
      }
      
      .nav-item.active {
        font-weight: bold;
      }
      
      .nav-item.active a {
        border-bottom: 2px solid #007bff;
      }
      
      .store-info {
        display: flex;
        align-items: center;
        position: relative;
        cursor: pointer;
      }
      
      .store-info img {
        height: 30px;
        margin-right: 10px;
      }
      
      .store-id {
        font-weight: 600;
        font-size: 16px;
        color: #2c3e50;
      }
      
      /* Admin indicator - subtle badge next to store name */
      .admin-mode-indicator {
        background: #f093fb;
        color: white;
        font-size: 10px;
        font-weight: bold;
        padding: 2px 6px;
        border-radius: 3px;
        margin-left: 8px;
        letter-spacing: 0.5px;
      }
      
      .auth-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        padding: 8px;
        min-width: 160px;
        opacity: 0;
        visibility: hidden;
        transition: all 0.2s ease;
        z-index: 1000;
        margin-top: 5px;
      }
      
      .store-info:hover .auth-dropdown {
        opacity: 1;
        visibility: visible;
      }
      
      .auth-dropdown .auth-info {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .auth-dropdown .admin-indicator {
        background: #f093fb;
        color: white;
        font-size: 11px;
        font-weight: bold;
        padding: 2px 8px;
        border-radius: 3px;
        text-align: center;
        letter-spacing: 0.5px;
      }
      
      .auth-dropdown .auth-status {
        color: #495057;
        font-size: 14px;
        font-weight: 500;
      }
      
      .auth-dropdown .logout-button {
        font-size: 14px;
        padding: 6px 12px;
        border-radius: 4px;
        background: #6c757d;
        color: white;
        border: none;
        cursor: pointer;
        text-align: center;
        transition: background 0.2s;
      }
      
      .auth-dropdown .logout-button:hover {
        background: #5a6268;
      }
      
      .auth-dropdown .login-link {
        display: block;
        text-decoration: none;
        background: #007bff;
        color: white;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 14px;
        text-align: center;
        transition: background 0.2s;
      }
      
      .auth-dropdown .login-link:hover {
        background: #0056b3;
      }
      
      .mobile-menu-toggle {
        display: none;
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
      }
      
      @media (max-width: 768px) {
        .nav-items {
          display: none;
        }
        
        .mobile-menu-toggle {
          display: block;
        }
        
        .nav-expanded .nav-items {
          display: flex;
          flex-direction: column;
          position: absolute;
          top: 60px;
          left: 0;
          right: 0;
          background: #f8f9fa;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          z-index: 1000;
        }
        
        .nav-expanded .nav-item {
          margin: 0;
          padding: 10px 20px;
          border-bottom: 1px solid #eee;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  setTimeout(() => {
    checkAuthStatus(storeId, authDropdown);
  }, 0);
  
  return nav;
}

/**
 * Initialize admin navigation
 * @param {string} containerId - The ID of the container element
 * @param {string} storeId - The store ID
 * @param {string} activePage - The active page
 */
async function initAdminNav(containerId, storeId, activePage) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const nav = await createAdminNav(storeId, activePage);
  container.insertBefore(nav, container.firstChild);
}

window.initAdminNav = initAdminNav;
window.createAdminNav = createAdminNav;