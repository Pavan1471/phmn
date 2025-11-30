const socketManager = require('../socket/socketManager');
const { registerUserHandlers } = require('../handlers/userHandler');
const TasksHandler = require('../handlers/tasksHandler');
const { sessionMiddleware, wrap } = require('../config/session');

module.exports = function (server) {
    // Get the IO instance from socketManager
    const io = socketManager.getIO();
    
    // Configure session middleware
    io.engine.on('initial_headers', (headers, req) => {
        if (req.cookieHolder) {
            headers['set-cookie'] = req.cookieHolder;
            delete req.cookieHolder;
        }
    });
    
    io.use(wrap(sessionMiddleware));
    
    io.on('connection', socket => {
        registerUserHandlers(socket);
        
        // Initialize tasks handler
        const tasksHandler = new TasksHandler(socket);
        
    
    });
};
