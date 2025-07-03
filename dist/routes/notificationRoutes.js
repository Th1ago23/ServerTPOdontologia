"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const NotificationController_1 = __importDefault(require("../controllers/NotificationController"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
router.get('/my', authMiddleware_1.authenticateToken, authMiddleware_1.authenticatePatient, NotificationController_1.default.getMyNotifications);
router.get('/unread-count', authMiddleware_1.authenticateToken, authMiddleware_1.authenticatePatient, NotificationController_1.default.getUnreadCount);
router.put('/:notificationId/read', authMiddleware_1.authenticateToken, authMiddleware_1.authenticatePatient, NotificationController_1.default.markAsRead);
router.put('/mark-all-read', authMiddleware_1.authenticateToken, authMiddleware_1.authenticatePatient, NotificationController_1.default.markAllAsRead);
router.delete('/:notificationId', authMiddleware_1.authenticateToken, authMiddleware_1.authenticatePatient, NotificationController_1.default.deleteNotification);
router.post('/create', authMiddleware_1.authenticateToken, authMiddleware_1.authenticatePatient, NotificationController_1.default.createNotification);
router.post('/process-scheduled', NotificationController_1.default.processScheduledNotifications);
exports.default = router;
