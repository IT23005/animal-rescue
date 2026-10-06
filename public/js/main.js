async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();

        const navLogin = document.getElementById('nav-login');
        const navLogout = document.getElementById('nav-logout');
        const navUser = document.getElementById('nav-user');
        const volunteerLink = document.getElementById('volunteer-link');
        const dashboardLink = document.getElementById('dashboard-link');

        if (data.loggedIn) {
            // Hide login, show logout
            if (navLogin) navLogin.style.display = 'none';
            if (navLogout) navLogout.style.display = 'inline';

            // Name as clickable profile link
            if (navUser) {
                navUser.innerHTML = '<a href="/profile" style="color:white; margin-left:20px;">👤 '
                    + data.user.name + '</a>';
            }

            // Hide become a volunteer
            if (volunteerLink) volunteerLink.innerHTML = '';

            // Show correct dashboard links
            if (dashboardLink) {
                if (data.user.role === 'admin') {
                    dashboardLink.innerHTML =
                        '<a href="/volunteer">Volunteer Panel</a>' +
                        '<a href="/admin" style="margin-left:20px;">Admin Panel</a>';
                } else if (data.user.role === 'volunteer') {
                    dashboardLink.innerHTML =
                        '<a href="/volunteer">Volunteer Panel</a>';
                } else {
                    dashboardLink.innerHTML = '';
                }
            }

        } else {
            // Not logged in
            if (navLogin) navLogin.style.display = 'inline';
            if (navLogout) navLogout.style.display = 'none';
            if (navUser) navUser.innerHTML = '';

            // Show become a volunteer
            if (volunteerLink) {
                volunteerLink.innerHTML =
                    '<a href="/volunteer-apply">Become a Volunteer</a>';
            }

            if (dashboardLink) dashboardLink.innerHTML = '';
        }

    } catch (err) {
        console.log('Auth check failed');
    }
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
}

checkAuth();