import { PrismaClient, NotificationType } from '@prisma/client';
import { sendEmail } from './emailService';

const prisma = new PrismaClient();

export interface CreateNotificationData {
  patientId: number;
  type: NotificationType;
  title: string;
  message: string;
  scheduledFor?: Date;
}

export class NotificationService {
  // Criar uma nova notificação
  static async createNotification(data: CreateNotificationData) {
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

      // Se não tem agendamento, enviar imediatamente
      if (!data.scheduledFor) {
        await this.sendNotification(notification);
      }

      return notification;
    } catch (error) {
      console.error('Erro ao criar notificação:', error);
      throw error;
    }
  }

  // Enviar notificação (email + marcar como enviada)
  static async sendNotification(notification: any) {
    try {
      // Tentar enviar email (opcional)
      try {
        await sendEmail({
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
      } catch (emailError) {
        // Email não enviado - não é crítico para o funcionamento
      }

      // Marcar como enviada
      await prisma.notification.update({
        where: { id: notification.id },
        data: { sentAt: new Date() },
      });

    } catch (error) {
      console.error('Erro ao processar notificação:', error);
      throw error;
    }
  }

  // Buscar notificações de um paciente
  static async getPatientNotifications(patientId: number, limit = 50) {
    try {
      const notifications = await prisma.notification.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return notifications;
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
      throw error;
    }
  }

  // Marcar notificação como lida
  static async markAsRead(notificationId: number) {
    try {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
      throw error;
    }
  }

  // Marcar todas as notificações como lidas
  static async markAllAsRead(patientId: number) {
    try {
      await prisma.notification.updateMany({
        where: { patientId, isRead: false },
        data: { isRead: true },
      });
    } catch (error) {
      console.error('Erro ao marcar todas as notificações como lidas:', error);
      throw error;
    }
  }

  // Contar notificações não lidas
  static async getUnreadCount(patientId: number) {
    try {
      const count = await prisma.notification.count({
        where: { patientId, isRead: false },
      });
      return count;
    } catch (error) {
      console.error('Erro ao contar notificações não lidas:', error);
      throw error;
    }
  }

  // Deletar notificação
  static async deleteNotification(notificationId: number, patientId: number) {
    try {
      // Verificar se a notificação pertence ao paciente
      const notification = await prisma.notification.findFirst({
        where: { 
          id: notificationId,
          patientId: patientId
        },
      });

      if (!notification) {
        throw new Error('Notificação não encontrada ou não pertence ao paciente');
      }

      await prisma.notification.delete({
        where: { id: notificationId },
      });
    } catch (error) {
      console.error('Erro ao deletar notificação:', error);
      throw error;
    }
  }

  // Criar notificação de confirmação de consulta
  static async createAppointmentConfirmation(patientId: number, appointmentData: any) {
    // Verificar se já existe uma notificação de confirmação para esta consulta
    const existingNotification = await prisma.notification.findFirst({
      where: {
        patientId,
        type: NotificationType.APPOINTMENT_CONFIRMED,
        title: 'Consulta Confirmada! 🦷',
        message: {
          contains: `${new Date(appointmentData.date).toLocaleDateString()} às ${appointmentData.time}`
        }
      }
    });

    if (existingNotification) {
      console.log('Notificação de confirmação já existe, pulando criação...');
      return existingNotification;
    }

    const title = 'Consulta Confirmada! 🦷';
    const message = `Sua consulta foi confirmada para ${new Date(appointmentData.date).toLocaleDateString()} às ${appointmentData.time}. 
    
    Procedimento: ${appointmentData.notes || 'Não especificado'}
    
    Aguardamos você!`;

    return this.createNotification({
      patientId,
      type: NotificationType.APPOINTMENT_CONFIRMED,
      title,
      message,
    });
  }

  // Criar lembrete de consulta (24h antes)
  static async createAppointmentReminder(patientId: number, appointmentData: any) {
    const appointmentDate = new Date(appointmentData.date);
    const reminderDate = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000); // 24h antes

    // Verificar se já existe um lembrete para esta consulta
    const existingReminder = await prisma.notification.findFirst({
      where: {
        patientId,
        type: NotificationType.APPOINTMENT_REMINDER,
        title: 'Lembrete: Sua consulta é amanhã! ⏰',
        message: {
          contains: `${appointmentDate.toLocaleDateString()} às ${appointmentData.time}`
        }
      }
    });

    if (existingReminder) {
      console.log('Lembrete já existe, pulando criação...');
      return existingReminder;
    }

    const title = 'Lembrete: Sua consulta é amanhã! ⏰';
    const message = `Olá! Lembramos que você tem uma consulta amanhã (${appointmentDate.toLocaleDateString()}) às ${appointmentData.time}.
    
    Procedimento: ${appointmentData.notes || 'Não especificado'}
    
    Não se esqueça! 😊`;

    return this.createNotification({
      patientId,
      type: NotificationType.APPOINTMENT_REMINDER,
      title,
      message,
      scheduledFor: reminderDate,
    });
  }

  // Processar notificações agendadas (deve ser executado por um cron job)
  static async processScheduledNotifications() {
    try {
      const scheduledNotifications = await prisma.notification.findMany({
        where: {
          scheduledFor: {
            lte: new Date(), // Menor ou igual a agora
          },
          sentAt: null, // Ainda não foi enviada
        },
        include: {
          patient: true,
        },
      });

      for (const notification of scheduledNotifications) {
        await this.sendNotification(notification);
      }

    } catch (error) {
      console.error('Erro ao processar notificações agendadas:', error);
      throw error;
    }
  }
} 