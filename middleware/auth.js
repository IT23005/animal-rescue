const isLoggedIn = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ message: 'Please login first' });
    }
};

const isVolunteer = (req, res, next) => {
    if (req.session.userId &&
        (req.session.userRole === 'volunteer' ||
            req.session.userRole === 'admin')) {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Volunteers only.' });
    }
};

const isAdmin = (req, res, next) => {
    if (req.session.userId && req.session.userRole === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admins only.' });
    }
};

module.exports = { isLoggedIn, isVolunteer, isAdmin };