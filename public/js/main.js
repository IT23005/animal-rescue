// Helper to escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}

// Global Auth Check & Navbar Synchronizer
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();

        const navLogin = document.getElementById('nav-login');
        const navLogout = document.getElementById('nav-logout');
        const navUser = document.getElementById('nav-user');
        const volunteerLink = document.getElementById('volunteer-link');
        const dashboardLink = document.getElementById('dashboard-link');

        if (data.loggedIn && data.user) {
            // Logged in state
            if (navLogin) navLogin.style.display = 'none';
            if (navLogout) navLogout.style.display = 'inline-flex';

            // User Profile Link with Avatar & Role Badge
            if (navUser) {
                let roleBadgeHtml = '';
                if (data.user.role === 'admin') {
                    roleBadgeHtml = '<span class="nav-role-badge badge-admin">Admin</span>';
                } else if (data.user.role === 'volunteer') {
                    roleBadgeHtml = '<span class="nav-role-badge badge-volunteer">Volunteer</span>';
                }

                navUser.innerHTML = `
                    <a href="/profile.html" class="nav-item nav-user-profile" title="View Profile">
                        <span class="user-name-text">${escapeHtml(data.user.name)}</span>
                        ${roleBadgeHtml}
                    </a>
                `;
            }

            // Hide "Become a Volunteer" for volunteers and admins
            if (volunteerLink) {
                if (data.user.role === 'public') {
                    volunteerLink.innerHTML = '<a href="/volunteer-apply.html" class="nav-item">Become a Volunteer</a>';
                } else {
                    volunteerLink.innerHTML = '';
                }
            }

            // Display role-specific dashboard panels without duplication
            if (dashboardLink) {
                let panelsHtml = '';
                if (data.user.role === 'admin') {
                    panelsHtml = `
                        <a href="/volunteer-dashboard.html" class="nav-item nav-panel-btn">Volunteer Panel</a>
                        <a href="/admin-dashboard.html" class="nav-item nav-panel-btn nav-admin-btn">Admin Panel</a>
                    `;
                } else if (data.user.role === 'volunteer') {
                    panelsHtml = `
                        <a href="/volunteer-dashboard.html" class="nav-item nav-panel-btn">Volunteer Panel</a>
                    `;
                } else {
                    panelsHtml = '';
                }
                dashboardLink.innerHTML = panelsHtml;
            }

        } else {
            // Visitor / Logged out state
            if (navLogin) navLogin.style.display = 'inline-flex';
            if (navLogout) navLogout.style.display = 'none';
            if (navUser) navUser.innerHTML = '';
            if (volunteerLink) {
                volunteerLink.innerHTML = '<a href="/volunteer-apply.html" class="nav-item">Become a Volunteer</a>';
            }
            if (dashboardLink) {
                dashboardLink.innerHTML = '';
            }
        }

        // Highlight active navbar link
        highlightActiveNavLink();

    } catch (err) {
        console.warn('Navbar auth verification failed:', err);
    }
}

// Highlight the currently active page in the navbar
function highlightActiveNavLink() {
    const currentPath = window.location.pathname.toLowerCase();
    const navLinks = document.querySelectorAll('.nav-links a');

    navLinks.forEach(link => {
        link.classList.remove('active');
        const href = (link.getAttribute('href') || '').toLowerCase();
        
        if (!href || href === '#') return;

        // Exact match or matches filename without extension
        if (
            href === currentPath ||
            (currentPath === '/' && (href === '/index.html' || href === '/')) ||
            (currentPath === '/index' && href === '/index.html') ||
            (currentPath === '/volunteer' && href === '/volunteer-dashboard.html') ||
            (currentPath === '/admin' && href === '/admin-dashboard.html') ||
            (currentPath === '/animals' && href === '/animals.html') ||
            (currentPath === '/report' && href === '/report.html') ||
            (currentPath === '/profile' && href === '/profile.html') ||
            (currentPath === '/login' && href === '/login.html') ||
            (currentPath === '/register' && href === '/register.html') ||
            (currentPath.endsWith('.html') && href === currentPath)
        ) {
            link.classList.add('active');
        }
    });
}

// Initialize Mobile Hamburger Menu
function initMobileNav() {
    const navToggle = document.getElementById('nav-toggle');
    const navLinks = document.getElementById('nav-links');

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            navLinks.classList.toggle('open');
            navToggle.classList.toggle('open');
        });

        // Close mobile drawer when clicking a link
        navLinks.addEventListener('click', (e) => {
            if (e.target.tagName === 'A' || e.target.closest('a')) {
                navLinks.classList.remove('open');
                navToggle.classList.remove('open');
            }
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!navLinks.contains(e.target) && !navToggle.contains(e.target)) {
                navLinks.classList.remove('open');
                navToggle.classList.remove('open');
            }
        });
    }
}

// Global Logout Handler
async function logout(e) {
    if (e && e.preventDefault) e.preventDefault();
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
        console.error('Logout error:', err);
    } finally {
        window.location.href = '/index.html';
    }
}

// Run on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initMobileNav();
        checkAuth();
    });
} else {
    initMobileNav();
    checkAuth();
}
