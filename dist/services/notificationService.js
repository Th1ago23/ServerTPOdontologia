"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const client_1 = require("@prisma/client");
const emailService_1 = require("./emailService");
const prisma = new client_1.PrismaClient();
class NotificationService {
    static async createNotification(data) {
        try {
            const notification = await prisma.notification.create({
                data: {
                    patientId: data.patientId,
                    type: data.type,
                    title: data.title,
                    message: data.message,
                    scheduledFor: data.scheduledFor,
                },
                include: {
                    patient: true,
                },
            });
            if (!data.scheduledFor) {
                await this.sendNotification(notification);
            }
            return notification;
        }
        catch (error) {
            console.error('Erro ao criar notificação:', error);
            throw error;
        }
    }
    static async sendNotification(notification) {
        try {
            try {
                await (0, emailService_1.sendEmail)({
                    to: notification.patient.email,
                    subject: notification.title,
                    text: notification.message,
                    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #800000;">${notification.title}</h2>
              <p>${notification.message}</p>
              <hr style="border: 1px solid #eee; margin: 20px 0;">
              <p style="color: #666; font-size: 12px;">
                TP Odontologia - Sistema de Notificações
              </p>
            </div>
          `,
                });
            }
            catch (emailError) {
            }
            await prisma.notification.update({
                where: { id: notification.id },
                data: { sentAt: new Date() },
            });
        }
        catch (error) {
            console.error('Erro ao processar notificação:', error);
            throw error;
        }
    }
    static async getPatientNotifications(patientId, limit = 50) {
        try {
            const notifications = await prisma.notification.findMany({
                where: { patientId },
                orderBy: { createdAt: 'desc' },
                take: limit,
            });
            return notifications;
        }
        catch (error) {
            console.error('Erro ao buscar notificações:', error);
            throw error;
        }
    }
    static async markAsRead(notificationId) {
        try {
            await prisma.notification.update({
                where: { id: notificationId },
                data: { isRead: true },
            });
        }
        catch (error) {
            console.error('Erro ao marcar notificação como lida:', error);
            throw error;
        }
    }
    static async markAllAsRead(patientId) {
        try {
            await prisma.notification.updateMany({
                where: { patientId, isRead: false },
                data: { isRead: true },
            });
        }
        catch (error) {
            console.error('Erro ao marcar todas as notificações como lidas:', error);
            throw error;
        }
    }
    static async getUnreadCount(patientId) {
        try {
            const count = await prisma.notification.count({
                where: { patientId, isRead: false },
            });
            return count;
        }
        catch (error) {
            console.error('Erro ao contar notificações não lidas:', error);
            throw error;
        }
    }
    static async createAppointmentConfirmation(patientId, appointmentData) {
        const title = 'Consulta Confirmada! 🦷';
        const message = `Sua consulta foi confirmada para ${new Date(appointmentData.date).toLocaleDateString()} às ${appointmentData.time}. 
    
    Procedimento: ${appointmentData.notes || 'Não especificado'}
    
    Aguardamos você!`;
        return this.createNotification({
            patientId,
            type: client_1.NotificationType.APPOINTMENT_CONFIRMED,
            title,
            message,
        });
    }
    static async createAppointmentReminder(patientId, appointmentData) {
        const appointmentDate = new Date(appointmentData.date);
        const reminderDate = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000);
        const title = 'Lembrete: Sua consulta é amanhã! ⏰';
        const message = `Olá! Lembramos que você tem uma consulta amanhã (${appointmentDate.toLocaleDateString()}) às ${appointmentData.time}.
    
    Procedimento: ${appointmentData.notes || 'Não especificado'}
    
    Não se esqueça! 😊`;
        return this.createNotification({
            patientId,
            type: client_1.NotificationType.APPOINTMENT_REMINDER,
            title,
            message,
            scheduledFor: reminderDate,
        });
    }
    static async processScheduledNotifications() {
        try {
            const scheduledNotifications = await prisma.notification.findMany({
                where: {
                    scheduledFor: {
                        lte: new Date(),
                    },
                    sentAt: null,
                },
                include: {
                    patient: true,
                },
            });
            for (const notification of scheduledNotifications) {
                await this.sendNotification(notification);
            }
        }
        catch (error) {
            console.error('Erro ao processar notificações agendadas:', error);
            throw error;
        }
    }
}
exports.NotificationService = NotificationService;
