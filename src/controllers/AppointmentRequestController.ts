import { Request, Response } from "express";
import { AppointmentStatus, PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middleware/authMiddleware"; // Importe seu middleware de autenticação principal
import { NotificationService } from "../services/notificationService";

const prisma = new PrismaClient();

class AppointmentRequestController {
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      console.log("=== INÍCIO DO CADASTRO DE CONSULTA ===");
      console.log("Headers recebidos:", req.headers);
      console.log("Body recebido:", req.body);
      console.log("PatientId do token:", req.patientId);

      const { date, time, notes } = req.body;
      const patientId = req.patientId;
  
      if (!patientId || !date || !time) {
        console.log("Erro: Dados obrigatórios faltando", { patientId, date, time });
        res.status(400).json({ error: "Paciente, data e hora são obrigatórios." });
        return;
      }
  
      const patient = await prisma.patient.findUnique({ where: { id: patientId } });
      console.log("Paciente encontrado:", patient);

      if (!patient) {
        console.log("Erro: Paciente não encontrado para o ID:", patientId);
        res.status(404).json({ error: "Paciente não encontrado." });
        return;
      }
  
      const dateObj = new Date(date);
      console.log("Data convertida:", dateObj);
  
      const isDateAvailable = await this.checkDateAvailability(dateObj);
      const isTimeAvailable = await this.checkTimeAvailability(dateObj, time);
      console.log("Disponibilidade:", { isDateAvailable, isTimeAvailable });
  
      if (!isDateAvailable || !isTimeAvailable) {
        console.log("Erro: Data ou hora indisponível");
        res.status(400).json({ error: "Data ou hora indisponível." });
        return;
      }
  
      const appointmentRequest = await prisma.appointmentRequest.create({
        data: {
          patientId: patientId,
          requestedDate: dateObj,
          requestedTime: time,
          notes,
          status: AppointmentStatus.PENDING,
        },
      });

      // Criar notificação de solicitação de consulta
      try {
        await NotificationService.createNotification({
          patientId,
          type: 'GENERAL',
          title: 'Solicitação de Consulta Enviada! 📋',
          message: `Sua solicitação de consulta para ${dateObj.toLocaleDateString()} às ${time} foi enviada com sucesso.
          
          Procedimento: ${notes || 'Não especificado'}
          
          Aguardamos a confirmação da Dra. Tatiane. Você receberá uma notificação assim que for confirmada!`,
        });
      } catch (notificationError) {
        console.error("Erro ao criar notificação:", notificationError);
        // Não falhar a criação da consulta se a notificação falhar
      }
  
      console.log("Consulta criada com sucesso:", appointmentRequest);
      res.status(201).json(appointmentRequest);
    } catch (error: unknown) {
      console.error("Erro detalhado ao solicitar consulta:", error);
      res.status(500).json({ error: "Erro ao solicitar consulta." });
    }
  }

  async listPatientAppointments(req: AuthRequest, res: Response): Promise<void> {
    try {
      const patientId = req.patientId;
      console.log("Listando consultas para o paciente ID (backend):", patientId);

      if (!patientId) {
        console.log("Erro: patientId não encontrado no request");
        res.status(401).json({ error: "Paciente não autenticado." });
        return;
      }

      console.log("Paciente ID usado na consulta Prisma:", patientId);

      const consultas = await prisma.appointmentRequest.findMany({
        where: {
          patientId: patientId,
        },
        include: {
          patient: true,
        },
        orderBy: { requestedDate: 'asc' },
      });

      console.log("Consultas encontradas (backend):", JSON.stringify(consultas, null, 2));
      console.log("Número de consultas encontradas (backend):", consultas.length);
      res.status(200).json(consultas);
    } catch (error) {
      console.error("Erro ao listar consultas do paciente:", error);
      res.status(500).json({ error: "Erro ao listar consultas do paciente." });
    }
  }

  private async checkDateAvailability(date: Date): Promise<boolean> {
    return true; // lógica futura
  }

  private async checkTimeAvailability(date: Date, time: string): Promise<boolean> {
    return true; // lógica futura
  }

  async cancelAppointment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { appointmentId } = req.params;
      const { reason } = req.body;
      const patientId = req.patientId;

      const appointment = await prisma.appointment.findUnique({
        where: { id: parseInt(appointmentId) },
        include: { appointmentRequests: true }
      });

      if (!appointment) {
        res.status(404).json({ error: "Consulta não encontrada." });
        return;
      }

      // Verificar se o paciente é o dono da consulta
      if (appointment.patientId !== patientId) {
        res.status(403).json({ error: "Você não tem permissão para cancelar esta consulta." });
        return;
      }

      // Atualizar status da consulta e solicitações relacionadas
      await prisma.$transaction([
        prisma.appointment.update({
          where: { id: parseInt(appointmentId) },
          data: { 
            status: AppointmentStatus.CANCELLED,
            notes: reason ? `Cancelada pelo paciente: ${reason}` : "Cancelada pelo paciente"
          }
        }),
        ...appointment.appointmentRequests.map(request =>
          prisma.appointmentRequest.update({
            where: { id: request.id },
            data: { 
              status: AppointmentStatus.CANCELLED,
              notes: reason ? `Cancelada pelo paciente: ${reason}` : "Cancelada pelo paciente"
            }
          })
        )
      ]);

      res.status(200).json({ message: "Consulta cancelada com sucesso." });
    } catch (error) {
      console.error("Erro ao cancelar consulta:", error);
      res.status(500).json({ error: "Erro ao cancelar consulta." });
    }
  }
}

export default new AppointmentRequestController();