import express from 'express';
import NotificationController from '../controllers/NotificationController';
import { authenticateToken, authenticatePatient } from '../middleware/authMiddleware';

const router = express.Router();

// Rotas protegidas para pacientes
router.get('/my', authenticateToken, authenticatePatient, NotificationController.getMyNotifications);
router.get('/unread-count', authenticateToken, authenticatePatient, NotificationController.getUnreadCount);
router.put('/:notificationId/read', authenticateToken, authenticatePatient, NotificationController.markAsRead);
router.put('/mark-all-read', authenticateToken, authenticatePatient, NotificationController.markAllAsRead);
router.delete('/:notificationId', authenticateToken, authenticatePatient, NotificationController.deleteNotification);
router.post('/create', authenticateToken, authenticatePatient, NotificationController.createNotification);

// Rota para processar notificações agendadas (pode ser chamada por cron job)
router.post('/process-scheduled', NotificationController.processScheduledNotifications);

export default router; 