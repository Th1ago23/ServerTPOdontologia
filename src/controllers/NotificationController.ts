import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { NotificationService } from '../services/notificationService';

class NotificationController {
  // Buscar notificações do paciente autenticado
  async getMyNotifications(req: AuthRequest, res: Response): Promise<void> {
    try {
      const patientId = req.patientId;
      if (!patientId) {
        res.status(401).json({ error: "Usuário não autenticado" });
        return;
      }

      const notifications = await NotificationService.getPatientNotifications(patientId);
      res.status(200).json(notifications);
    } catch (error) {
      console.error("Erro ao buscar notificações:", error);
      res.status(500).json({ error: "Erro ao buscar notificações" });
    }
  }

  // Marcar notificação como lida
  async markAsRead(req: AuthRequest, res: Response): Promise<void> {
    try {
      const patientId = req.patientId;
      const { notificationId } = req.params;

      if (!patientId) {
        res.status(401).json({ error: "Usuário não autenticado" });
        return;
      }

      await NotificationService.markAsRead(parseInt(notificationId));
      res.status(200).json({ message: "Notificação marcada como lida" });
    } catch (error) {
      console.error("Erro ao marcar notificação como lida:", error);
      res.status(500).json({ error: "Erro ao marcar notificação como lida" });
    }
  }

  // Marcar todas as notificações como lidas
  async markAllAsRead(req: AuthRequest, res: Response): Promise<void> {
    try {
      const patientId = req.patientId;
      if (!patientId) {
        res.status(401).json({ error: "Usuário não autenticado" });
        return;
      }

      await NotificationService.markAllAsRead(patientId);
      res.status(200).json({ message: "Todas as notificações marcadas como lidas" });
    } catch (error) {
      console.error("Erro ao marcar todas as notificações como lidas:", error);
      res.status(500).json({ error: "Erro ao marcar notificações como lidas" });
    }
  }

  // Contar notificações não lidas
  async getUnreadCount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const patientId = req.patientId;
      if (!patientId) {
        res.status(401).json({ error: "Usuário não autenticado" });
        return;
      }

      const count = await NotificationService.getUnreadCount(patientId);
      res.status(200).json({ count });
    } catch (error) {
      console.error("Erro ao contar notificações não lidas:", error);
      res.status(500).json({ error: "Erro ao contar notificações" });
    }
  }

  // Criar notificação manual (para testes)
  async createNotification(req: AuthRequest, res: Response): Promise<void> {
    try {
      const patientId = req.patientId;
      const { title, message, type } = req.body;

      if (!patientId) {
        res.status(401).json({ error: "Usuário não autenticado" });
        return;
      }

      const notification = await NotificationService.createNotification({
        patientId,
        type,
        title,
        message,
      });

      res.status(201).json(notification);
    } catch (error) {
      console.error("Erro ao criar notificação:", error);
      res.status(500).json({ error: "Erro ao criar notificação" });
    }
  }

  // Deletar notificação
  async deleteNotification(req: AuthRequest, res: Response): Promise<void> {
    try {
      const patientId = req.patientId;
      const { notificationId } = req.params;

      if (!patientId) {
        res.status(401).json({ error: "Usuário não autenticado" });
        return;
      }

      await NotificationService.deleteNotification(parseInt(notificationId), patientId);
      res.status(200).json({ message: "Notificação deletada com sucesso" });
    } catch (error) {
      console.error("Erro ao deletar notificação:", error);
      res.status(500).json({ error: "Erro ao deletar notificação" });
    }
  }

  // Processar notificações agendadas (endpoint para cron job)
  async processScheduledNotifications(req: Request, res: Response): Promise<void> {
    try {
      await NotificationService.processScheduledNotifications();
      res.status(200).json({ message: "Notificações agendadas processadas" });
    } catch (error) {
      console.error("Erro ao processar notificações agendadas:", error);
      res.status(500).json({ error: "Erro ao processar notificações" });
    }
  }
}

export default new NotificationController(); 