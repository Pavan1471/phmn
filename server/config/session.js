const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);

const store = new MongoDBStore({
    uri: process.env.CONNECTION_URI,
    collection: 'sessions',
});
const sessionMiddleware = session({
    store: store,
    credentials: true,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
    },
    secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
    saveUninitialized: true,
    resave: true,
    maxAge: 86400000, // 24 hours instead of 20 seconds
});

const wrap = expressMiddleware => (socket, next) => expressMiddleware(socket.request, {}, next);

module.exports = { sessionMiddleware, wrap };
