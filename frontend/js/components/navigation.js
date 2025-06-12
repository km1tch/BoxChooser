async function checkAuthStatus(storeId, container) {
  if (typeof AuthManager !== "undefined") {
    AuthManager.initAuthUI(container.id, storeId);
  }
}

async function createAdminNav(storeId, activePage = "prices") {
  const nav = document.createElement("nav");
  nav.className = "admin-nav";

  // Get auth status first to determine what to show
  let authStatus = { hasAuth: false, isAuthenticated: false, authLevel: null };
  if (typeof AuthManager !== "undefined") {
    try {
      authStatus = await AuthManager.getAuthStatus(storeId);
    } catch (error) {
      // Silently handle auth status errors
    }
  }

  const storeInfo = document.createElement("div");
  storeInfo.className = "store-info";

  const storeLogo = document.createElement("img");
  storeLogo.src = "/assets/icons/logo.png";
  storeLogo.alt = "Store Logo";
  storeLogo.onerror = function () {
    this.style.display = "none";
  };

  const storeIdSpan = document.createElement("span");
  storeIdSpan.className = "store-id";
  storeIdSpan.textContent = `Store #${storeId}`;

  // Add auth mode indicator
  if (authStatus.isAuthenticated) {
    const indicator = document.createElement("span");
    indicator.className = "admin-mode-indicator";

    // Check if this is a sudo session
    const isSudo = localStorage.getItem(`store_${storeId}_is_sudo`) === "true";

    if (isSudo) {
      indicator.textContent = "SUPERADMIN SUDO";
      indicator.style.background = "#e74c3c"; // Red for superadmin
    } else if (authStatus.isDemo) {
      indicator.textContent =
        authStatus.authLevel === "admin" ? "DEMO ADMIN" : "DEMO";
      indicator.style.background = "#17a2b8"; // Teal for demo
    } else if (authStatus.authLevel === "admin") {
      indicator.textContent = "ADMIN";
      indicator.style.background = "#f093fb"; // Purple for admin
    }

    if (indicator.textContent) {
      storeIdSpan.appendChild(indicator);
    }
  }

  const authDropdown = document.createElement("div");
  authDropdown.className = "auth-dropdown";
  authDropdown.id = `auth-dropdown-${storeId}-${Date.now()}`;

  storeInfo.appendChild(storeLogo);
  storeInfo.appendChild(storeIdSpan);
  storeInfo.appendChild(authDropdown);

  // Remove click handler for mobile - we now have logout in the menu

  // Only show navbar at all if store has auth configured
  if (!authStatus.hasAuth) {
    // No auth configured - return empty div (no navbar)
    return document.createElement("div");
  }

  nav.appendChild(storeInfo);

  // Show nav items based on authentication status
  const navItems = document.createElement("ul");
  navItems.className = "nav-items";

  // Define nav items based on auth level
  const userItems = [
    { id: "wizard", label: "Wizard", href: "/wizard" },
    { id: "prices", label: "Price Table", href: "/prices" },
  ];

  const adminItems = [
    { id: "wizard", label: "Wizard", href: "/wizard" },
    { id: "packing", label: "Packing Calc", href: "/packing" },
    { id: "boxes", label: "Box Inventory", href: "/boxes" },
    { id: "prices", label: "Edit Prices", href: "/prices" },
    { id: "import", label: "Import", href: "/import" },
    { id: "floorplan", label: "Floorplan", href: "/floorplan" },
    { id: "settings", label: "Settings", href: "/settings" },
  ];
  
  // Check if we should show getting started link
  let showGettingStarted = false;
  try {
    const statsResponse = await fetch(`/api/store/${storeId}/stats`, {
      headers: { 
        'Authorization': `Bearer ${AuthManager.getToken(storeId)}`
      }
    });
    
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      // Show getting started if start-screen is true OR if store has no boxes
      showGettingStarted = stats.start_screen || stats.total_boxes === 0;
    }
  } catch (error) {
    console.error('Failed to check store stats:', error);
  }
  
  // Add getting started to admin items if needed
  if (showGettingStarted && authStatus.authLevel === "admin") {
    adminItems.push({ id: "getting-started", label: "Setup Guide ✨", href: "/getting-started" });
  }

  // Filter items based on auth status and level
  let items;
  if (authStatus.isAuthenticated) {
    if (authStatus.authLevel === "admin") {
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

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = `nav-item${activePage === item.id ? " active" : ""}`;

    const a = document.createElement("a");
    a.href = item.href;
    a.textContent = item.label;

    li.appendChild(a);
    navItems.appendChild(li);
  });

  // Add logout option for mobile only (if authenticated)
  if (authStatus.isAuthenticated) {
    const logoutLi = document.createElement("li");
    logoutLi.className = "nav-item mobile-only-logout";

    const logoutA = document.createElement("a");
    logoutA.href = "#";
    logoutA.textContent = "Sign Out";
    logoutA.addEventListener("click", (e) => {
      e.preventDefault();
      if (typeof AuthManager !== "undefined") {
        AuthManager.logout(storeId);
      }
    });

    logoutLi.appendChild(logoutA);
    navItems.appendChild(logoutLi);
  }

  nav.appendChild(navItems);

  const mobileMenuToggle = document.createElement("button");
  mobileMenuToggle.className = "mobile-menu-toggle";
  mobileMenuToggle.innerHTML = '<span class="hamburger-icon">☰</span>';
  mobileMenuToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    nav.classList.toggle("nav-expanded");

    // Update hamburger icon
    const icon = mobileMenuToggle.querySelector(".hamburger-icon");
    if (nav.classList.contains("nav-expanded")) {
      icon.textContent = "✕";
    } else {
      icon.textContent = "☰";
    }
  });

  // Close menu when clicking outside
  document.addEventListener("click", (e) => {
    if (!nav.contains(e.target) && nav.classList.contains("nav-expanded")) {
      nav.classList.remove("nav-expanded");
      const icon = mobileMenuToggle.querySelector(".hamburger-icon");
      icon.textContent = "☰";
    }
  });

  // Close menu when navigating
  navItems.addEventListener("click", () => {
    if (nav.classList.contains("nav-expanded")) {
      nav.classList.remove("nav-expanded");
      const icon = mobileMenuToggle.querySelector(".hamburger-icon");
      icon.textContent = "☰";
    }
  });

  nav.appendChild(mobileMenuToggle);

  // Add the CSS for the navigation
  const styleExists = document.getElementById("admin-nav-style");
  if (!styleExists) {
    const style = document.createElement("style");
    style.id = "admin-nav-style";
    style.textContent = `
      .admin-nav {
        display: flex;
        align-items: center;
        background: #E3F2FD;
        padding: 10px 20px;
        box-shadow: 0 2px 4px rgba(74, 144, 226, 0.25);
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
        border: 1px solid #90CAF9;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(74, 144, 226, 0.3);
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
      
      /* Hide mobile-only items on desktop */
      .mobile-only-logout {
        display: none;
      }
      
      @media (max-width: 768px) {
        .admin-nav {
          position: relative;
        }
        
        .nav-items {
          display: none;
        }
        
        .mobile-menu-toggle {
          display: block;
          position: absolute;
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 1001;
        }
        
        .nav-expanded .nav-items {
          display: flex;
          flex-direction: column;
          position: absolute;
          top: 60px;
          left: 0;
          right: 0;
          background: #E3F2FD;
          box-shadow: 0 2px 4px rgba(74, 144, 226, 0.25);
          z-index: 1000;
          padding: 10px 0;
        }
        
        .nav-expanded .nav-item {
          margin: 0;
          padding: 0;
        }
        
        .nav-expanded .nav-item a {
          display: block;
          padding: 12px 20px;
          border-radius: 0;
        }
        
        .nav-expanded .nav-item:not(:last-child) {
          border-bottom: 1px solid #BBDEFB;
        }
        
        /* Auth dropdown adjustments for mobile */
        .auth-dropdown {
          position: fixed !important;
          width: 90vw !important;
          max-width: 300px !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          top: 70px !important;
        }
        
        /* Store info should still be clickable on mobile */
        .store-info {
          padding-right: 50px; /* Space for hamburger */
        }
        
        /* Show logout in mobile menu */
        .mobile-only-logout {
          display: block !important;
          border-top: 2px solid #90CAF9;
          margin-top: 10px;
        }
        
        .mobile-only-logout a {
          color: #d32f2f !important;
          font-weight: 600;
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
