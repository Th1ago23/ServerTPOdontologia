"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const notificationService_1 = require("../services/notificationService");
class NotificationController {
    async getMyNotifications(req, res) {
        try {
            const patientId = req.patientId;
            if (!patientId) {
                res.status(401).json({ error: "Usuário não autenticado" });
                return;
            }
            const notifications = await notificationService_1.NotificationService.getPatientNotifications(patientId);
            res.status(200).json(notifications);
        }
        catch (error) {
            console.error("Erro ao buscar notificações:", error);
            res.status(500).json({ error: "Erro ao buscar notificações" });
        }
    }
    async markAsRead(req, res) {
        try {
            const patientId = req.patientId;
            const { notificationId } = req.params;
            if (!patientId) {
                res.status(401).json({ error: "Usuário não autenticado" });
                return;
            }
            await notificationService_1.NotificationService.markAsRead(parseInt(notificationId));
            res.status(200).json({ message: "Notificação marcada como lida" });
        }
        catch (error) {
            console.error("Erro ao marcar notificação como lida:", error);
            res.status(500).json({ error: "Erro ao marcar notificação como lida" });
        }
    }
    async markAllAsRead(req, res) {
        try {
            const patientId = req.patientId;
            if (!patientId) {
                res.status(401).json({ error: "Usuário não autenticado" });
                return;
            }
            await notificationService_1.NotificationService.markAllAsRead(patientId);
            res.status(200).json({ message: "Todas as notificações marcadas como lidas" });
        }
        catch (error) {
            console.error("Erro ao marcar todas as notificações como lidas:", error);
            res.status(500).json({ error: "Erro ao marcar notificações como lidas" });
        }
    }
    async getUnreadCount(req, res) {
        try {
            const patientId = req.patientId;
            if (!patientId) {
                res.status(401).json({ error: "Usuário não autenticado" });
                return;
            }
            const count = await notificationService_1.NotificationService.getUnreadCount(patientId);
            res.status(200).json({ count });
        }
        catch (error) {
            console.error("Erro ao contar notificações não lidas:", error);
            res.status(500).json({ error: "Erro ao contar notificações" });
        }
    }
    async createNotification(req, res) {
        try {
            const patientId = req.patientId;
            const { title, message, type } = req.body;
            if (!patientId) {
                res.status(401).json({ error: "Usuário não autenticado" });
                return;
            }
            const notification = await notificationService_1.NotificationService.createNotification({
                patientId,
                type,
                title,
                message,
            });
            res.status(201).json(notification);
        }
        catch (error) {
            console.error("Erro ao criar notificação:", error);
            res.status(500).json({ error: "Erro ao criar notificação" });
        }
    }
    async processScheduledNotifications(req, res) {
        try {
            await notificationService_1.NotificationService.processScheduledNotifications();
            res.status(200).json({ message: "Notificações agendadas processadas" });
        }
        catch (error) {
            console.error("Erro ao processar notificações agendadas:", error);
            res.status(500).json({ error: "Erro ao processar notificações" });
        }
    }
}
exports.default = new NotificationController();
