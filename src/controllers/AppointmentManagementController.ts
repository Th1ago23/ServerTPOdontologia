import { Request, Response } from "express";
import { PrismaClient, AppointmentStatus } from "@prisma/client";
import { AuthRequest } from "../middleware/authMiddleware";
import { NotificationService } from "../services/notificationService";

const prisma = new PrismaClient();

interface ConfirmedAppointment {
  id: number;
  date: string;
  time: string;
  status: AppointmentStatus;
  type: 'confirmed';
  patient: {
    id: number;
    name: string;
    email: string;
    phone: string;
  };
}

interface PendingAppointment {
  id: number;
  requestedDate: string;
  requestedTime: string;
  status: AppointmentStatus;
  type: 'pending';
  patient: {
    id: number;
    name: string;
    email: string;
    phone: string;
  };
}

type CombinedAppointment = ConfirmedAppointment | PendingAppointment;

class AppointmentManagementController {
  async listPending(req: AuthRequest, res: Response): Promise<void> {
    try {
      const pendingRequests = await prisma.appointmentRequest.findMany({
        where: { status: AppointmentStatus.PENDING },
        include: { patient: true } as any,
      });
      res.status(200).json(pendingRequests);
    } catch (error) {
      console.error("Erro ao listar solicitações pendentes:", error);
      res.status(500).json({ error: "Erro ao listar solicitações pendentes." });
    }
  }

  async listAllAppointmentRequests(req: AuthRequest, res: Response): Promise<void> {
    try {
      console.log('Debug - listAllAppointmentRequests chamado');
      console.log('Debug - req.userId:', req.userId);
      console.log('Debug - req.isAdmin:', req.isAdmin);
      console.log('Debug - req.userType:', req.userType);
      
      const { status } = req.query;
      console.log('Debug - status query:', status);
      
      const whereClause: any = {};
      if (status && status !== 'all') {
        whereClause.status = status as AppointmentStatus;
      }
      console.log('Debug - whereClause:', whereClause);

      const requests = await prisma.appointmentRequest.findMany({
        where: whereClause,
        include: { patient: true } as any,
        orderBy: { requestedDate: 'asc' } as any,
      });
      
      console.log('Debug - requests encontradas:', requests.length);
      
      // Log detalhado das datas para debug
      requests.forEach((request, index) => {
        console.log(`Request ${index + 1}:`, {
          id: request.id,
          requestedDate: request.requestedDate,
          requestedDateType: typeof request.requestedDate,
          requestedDateISO: request.requestedDate.toISOString(),
          requestedTime: request.requestedTime,
          status: request.status
        });
      });


      const requestsSerializadas = requests.map(request => ({
        ...request,
        requestedDate: request.requestedDate.toISOString(),
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
        confirmedAt: request.confirmedAt?.toISOString() || null,
        cancelledAt: request.cancelledAt?.toISOString() || null,
        rescheduledAt: request.rescheduledAt?.toISOString() || null,
        completedAt: request.completedAt?.toISOString() || null,
      }));

      res.status(200).json(requestsSerializadas);
    } catch (error) {
      console.error("Erro ao listar solicitações de consulta:", error);
      res.status(500).json({ error: "Erro ao listar solicitações de consulta." });
    }
  }

  async approve(req: AuthRequest, res: Response): Promise<void> {
    try {
      console.log('🔍 Approve - Iniciando método');
      console.log('🔍 Approve - req.params:', req.params);
      console.log('🔍 Approve - req.body:', req.body);
      console.log('🔍 Approve - req.userId:', req.userId);
      console.log('🔍 Approve - req.isAdmin:', req.isAdmin);
      
      const { requestId } = req.params;
      
      if (!requestId || isNaN(parseInt(requestId))) {
        console.log('❌ ID de solicitação inválido:', requestId);
        res.status(400).json({ error: "ID de solicitação inválido." });
        return;
      }

      console.log('🔍 Buscando solicitação com ID:', parseInt(requestId));
      
      const appointmentRequest = await prisma.appointmentRequest.findUnique({
        where: { id: parseInt(requestId) },
        include: { patient: true }
      });

      console.log('🔍 Solicitação encontrada:', appointmentRequest);

      if (!appointmentRequest) {
        console.log('❌ Solicitação não encontrada');
        res.status(404).json({ error: "Solicitação não encontrada." });
        return;
      }

      // Verificar se já não foi aprovada
      if (appointmentRequest.status === AppointmentStatus.CONFIRMED) {
        console.log('❌ Solicitação já confirmada');
        res.status(400).json({ error: "Esta solicitação já foi confirmada." });
        return;
      }

      console.log('🔍 Verificando disponibilidade do horário...');
      const isTimeSlotFree = await this.checkTimeSlotAvailability(
        appointmentRequest.patientId,
        appointmentRequest.requestedDate,
        appointmentRequest.requestedTime
      );
      
      console.log('🔍 Horário disponível:', isTimeSlotFree);
      
      if (!isTimeSlotFree) {
        console.log('❌ Horário já ocupado');
        res.status(409).json({ error: "O horário solicitado já está ocupado." });
        return;
      }

      console.log('🔍 Verificando horário de funcionamento...');
      const isWithinWorkingHours = this.checkWorkingHours(
        appointmentRequest.requestedDate, 
        appointmentRequest.requestedTime
      );
      
      console.log('🔍 Dentro do horário de funcionamento:', isWithinWorkingHours);
      
      if (!isWithinWorkingHours) {
        console.log('❌ Fora do horário de funcionamento');
        res.status(400).json({ error: "O horário solicitado está fora do horário de funcionamento." });
        return;
      }

      console.log('✅ Todas as validações passaram, criando agendamento...');

      // Criar a consulta real
      const newAppointment = await prisma.appointment.create({
        data: {
          patientId: appointmentRequest.patientId,
          date: appointmentRequest.requestedDate,
          time: appointmentRequest.requestedTime,
          notes: appointmentRequest.notes,
          status: AppointmentStatus.CONFIRMED
        },
      });

      console.log('✅ Novo agendamento criado:', newAppointment);

      // Atualizar o status da solicitação
      await prisma.appointmentRequest.update({
        where: { id: parseInt(requestId) },
        data: { 
          status: AppointmentStatus.CONFIRMED, 
          appointmentId: newAppointment.id 
        },
      });

      console.log('✅ Status da solicitação atualizado');

      // Criar notificação de confirmação
      try {
        console.log('🔍 Criando notificações...');
        await NotificationService.createAppointmentConfirmation(
          appointmentRequest.patientId,
          {
            date: appointmentRequest.requestedDate,
            time: appointmentRequest.requestedTime,
            notes: appointmentRequest.notes,
          }
        );

        // Criar lembrete 24h antes
        await NotificationService.createAppointmentReminder(
          appointmentRequest.patientId,
          {
            date: appointmentRequest.requestedDate,
            time: appointmentRequest.requestedTime,
            notes: appointmentRequest.notes,
          }
        );
        console.log('✅ Notificações criadas com sucesso');
      } catch (notificationError) {
        console.error("Erro ao criar notificações:", notificationError);
        // Não falhar a aprovação se as notificações falharem
      }

      console.log('✅ Aprovação concluída com sucesso');
      res.status(201).json({ 
        message: "Solicitação aprovada com sucesso.",
        appointment: newAppointment
      });
    } catch (error) {
      console.error("❌ Erro detalhado ao aprovar consulta:", {
        error,
        message: (error as any).message,
        stack: (error as any).stack
      });
      res.status(500).json({ error: "Erro interno do servidor ao aprovar consulta." });
    }
  }

  async reject(req: AuthRequest, res: Response): Promise<void> {
    try {
      console.log('🔍 Reject - Iniciando método');
      console.log('🔍 Reject - req.params:', req.params);
      console.log('🔍 Reject - req.body:', req.body);
      console.log('🔍 Reject - req.userId:', req.userId);
      console.log('🔍 Reject - req.isAdmin:', req.isAdmin);
      
      const { requestId } = req.params;
      
      if (!requestId || isNaN(parseInt(requestId))) {
        console.log('❌ ID de solicitação inválido:', requestId);
        res.status(400).json({ error: "ID de solicitação inválido." });
        return;
      }

      console.log('🔍 Buscando solicitação com ID:', parseInt(requestId));
      
      const appointmentRequest = await prisma.appointmentRequest.findUnique({
        where: { id: parseInt(requestId) },
        include: { patient: true }
      });

      console.log('🔍 Solicitação encontrada:', appointmentRequest);

      if (!appointmentRequest) {
        console.log('❌ Solicitação não encontrada');
        res.status(404).json({ error: "Solicitação não encontrada." });
        return;
      }

      // Verificar se já não foi rejeitada
      if (appointmentRequest.status === AppointmentStatus.CANCELLED) {
        console.log('❌ Solicitação já cancelada');
        res.status(400).json({ error: "Esta solicitação já foi cancelada." });
        return;
      }

      console.log('✅ Atualizando status para CANCELLED...');
      
      await prisma.appointmentRequest.update({
        where: { id: parseInt(requestId) },
        data: { status: AppointmentStatus.CANCELLED },
      });

      console.log('✅ Status da solicitação atualizado');

      // Criar notificação de rejeição
      try {
        console.log('🔍 Criando notificação de rejeição...');
        await NotificationService.createNotification({
          patientId: appointmentRequest.patientId,
          type: 'APPOINTMENT_CANCELLED',
          title: 'Consulta Não Confirmada ❌',
          message: `Infelizmente sua solicitação de consulta para ${appointmentRequest.requestedDate.toLocaleDateString()} às ${appointmentRequest.requestedTime} não pôde ser confirmada.
          
          Procedimento: ${appointmentRequest.notes || 'Não especificado'}
          
          Entre em contato conosco para reagendar em outro horário disponível.`,
        });
        console.log('✅ Notificação de rejeição criada com sucesso');
      } catch (notificationError) {
        console.error("Erro ao criar notificação de rejeição:", notificationError);
        // Não falhar a rejeição se as notificações falharem
      }

      console.log('✅ Rejeição concluída com sucesso');
      res.status(200).json({ message: "Solicitação de consulta rejeitada com sucesso." });
    } catch (error) {
      console.error("❌ Erro detalhado ao rejeitar consulta:", {
        error,
        message: (error as any).message,
        stack: (error as any).stack
      });
      res.status(500).json({ error: "Erro interno do servidor ao rejeitar consulta." });
    }
  }

  async reschedule(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { requestId } = req.params;
      const { newDate, newTime, notes } = req.body;

      console.log('Tentando reagendar consulta:', { requestId, newDate, newTime });

      if (!requestId || isNaN(parseInt(requestId))) {
        res.status(400).json({ error: "ID de solicitação inválido." });
        return;
      }

      if (!newDate || !newTime) {
        res.status(400).json({ error: "Nova data e horário são obrigatórios." });
        return;
      }

      // Validar se a nova data não é no passado
      const selectedDateTime = new Date(`${newDate}T${newTime}`);
      const now = new Date();
      if (selectedDateTime <= now) {
        res.status(400).json({ error: "A nova data e horário devem ser no futuro." });
        return;
      }

      const appointmentRequest = await prisma.appointmentRequest.findUnique({
        where: { id: parseInt(requestId) },
        include: { patient: true }
      });

      if (!appointmentRequest) {
        res.status(404).json({ error: "Solicitação não encontrada." });
        return;
      }

      // Verificar se a solicitação não foi cancelada
      if (appointmentRequest.status === AppointmentStatus.CANCELLED) {
        res.status(400).json({ error: "Não é possível reagendar uma solicitação cancelada." });
        return;
      }

      // Verificar disponibilidade para a nova data e hora
      const isNewTimeSlotFree = await this.checkTimeSlotAvailability(
        appointmentRequest.patientId,
        new Date(newDate),
        newTime
      );
      
      if (!isNewTimeSlotFree) {
        res.status(409).json({ error: "O novo horário selecionado já está ocupado." });
        return;
      }

      // Verificar se o novo horário está dentro do horário de funcionamento
      const isWithinWorkingHours = this.checkWorkingHours(new Date(newDate), newTime);
      if (!isWithinWorkingHours) {
        res.status(400).json({ error: "O novo horário selecionado está fora do horário de funcionamento (8:00 às 18:00)." });
        return;
      }

      const oldDate = appointmentRequest.requestedDate;
      const oldTime = appointmentRequest.requestedTime;

      // Atualizar a solicitação
      const updatedRequest = await prisma.appointmentRequest.update({
        where: { id: parseInt(requestId) },
        data: { 
          requestedDate: new Date(newDate), 
          requestedTime: newTime, 
          status: AppointmentStatus.RESCHEDULED,
          notes: notes || appointmentRequest.notes
        }
      });

      // Criar notificação de reagendamento
      try {
        await NotificationService.createNotification({
          patientId: appointmentRequest.patientId,
          type: 'APPOINTMENT_RESCHEDULED',
          title: 'Consulta Reagendada! 📅',
          message: `Sua consulta foi reagendada com sucesso!
          
          Data anterior: ${oldDate.toLocaleDateString()} às ${oldTime}
          Nova data: ${new Date(newDate).toLocaleDateString()} às ${newTime}
          
          Procedimento: ${notes || appointmentRequest.notes || 'Não especificado'}
          
          Aguardamos você no novo horário!`,
        });
      } catch (notificationError) {
        console.error("Erro ao criar notificação de reagendamento:", notificationError);
        // Não falhar o reagendamento se as notificações falharem
      }

      console.log('Solicitação reagendada com sucesso:', updatedRequest);
      res.status(200).json({ 
        message: "Solicitação de consulta reagendada com sucesso.",
        request: updatedRequest
      });
    } catch (error) {
      console.error("Erro ao reagendar consulta:", error);
      res.status(500).json({ error: "Erro interno do servidor ao reagendar consulta." });
    }
  }

  // Novos métodos para o app mobile
  async listAllAppointments(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Buscar consultas confirmadas
      const appointments = await prisma.appointment.findMany({
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          }
        },
        orderBy: [{ date: 'asc' }, { time: 'asc' }]
      });

      // Buscar solicitações pendentes
      const pendingRequests = await prisma.appointmentRequest.findMany({
        where: {
          status: AppointmentStatus.PENDING
        },
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          }
        } as any,
        orderBy: [
          { requestedDate: 'asc' } as any,
          { requestedTime: 'asc' } as any
        ]
      });

      // Combinar os resultados
      const allAppointments: CombinedAppointment[] = [
        ...appointments.map(apt => ({
          id: apt.id,
          date: apt.date.toISOString(),
          time: apt.time,
          status: apt.status,
          type: 'confirmed' as const,
          patient: apt.patient
        })),
        ...pendingRequests.map((req: any) => ({
          id: req.id,
          requestedDate: req.requestedDate.toISOString(),
          requestedTime: req.requestedTime,
          status: req.status,
          type: 'pending' as const,
          patient: req.patient
        }))
      ].sort((a, b) => {
        const dateA = new Date(a.type === 'confirmed' ? a.date : a.requestedDate);
        const dateB = new Date(b.type === 'confirmed' ? b.date : b.requestedDate);
        if (dateA.getTime() === dateB.getTime()) {
          const timeA = a.type === 'confirmed' ? a.time : a.requestedTime;
          const timeB = b.type === 'confirmed' ? b.time : b.requestedTime;
          return timeA.localeCompare(timeB);
        }
        return dateA.getTime() - dateB.getTime();
      });

      res.status(200).json(allAppointments);
    } catch (error) {
      console.error("Erro ao listar consultas:", error);
      res.status(500).json({ error: "Erro ao listar consultas." });
    }
  }

  async listAppointmentsByStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { status } = req.params;
      const appointments = await prisma.appointment.findMany({
        where: {
          appointmentRequests: {
            some: {
              status: status as AppointmentStatus
            }
          }
        },
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          appointmentRequests: true
        },
        orderBy: [{ date: 'asc' }, { time: 'asc' }]
      });
      res.status(200).json(appointments);
    } catch (error) {
      console.error("Erro ao listar consultas por status:", error);
      res.status(500).json({ error: "Erro ao listar consultas por status." });
    }
  }

  async listAppointmentsByDate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { date } = req.params;
      const appointments = await prisma.appointment.findMany({
        where: {
          date: new Date(date)
        },
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          appointmentRequests: true
        },
        orderBy: [{ date: 'asc' }, { time: 'asc' }]
      });
      res.status(200).json(appointments);
    } catch (error) {
      console.error("Erro ao listar consultas por data:", error);
      res.status(500).json({ error: "Erro ao listar consultas por data." });
    }
  }

  async getAppointmentDetails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { appointmentId } = req.params;
      const appointment = await prisma.appointment.findUnique({
        where: { id: parseInt(appointmentId) },
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              birthDate: true,
              address: true
            }
          },
          appointmentRequests: true
        }
      });

      if (!appointment) {
        res.status(404).json({ error: "Consulta não encontrada." });
        return;
      }

      res.status(200).json(appointment);
    } catch (error) {
      console.error("Erro ao buscar detalhes da consulta:", error);
      res.status(500).json({ error: "Erro ao buscar detalhes da consulta." });
    }
  }

  async cancelAppointment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { appointmentId } = req.params;
      const { reason } = req.body;

      const appointment = await prisma.appointment.findUnique({
        where: { id: parseInt(appointmentId) },
        include: { 
          appointmentRequests: true,
          patient: true
        }
      });

      if (!appointment) {
        res.status(404).json({ error: "Consulta não encontrada." });
        return;
      }

      // Atualizar status da consulta e solicitações relacionadas
      await prisma.$transaction([
        prisma.appointment.update({
          where: { id: parseInt(appointmentId) },
          data: { 
            status: AppointmentStatus.CANCELLED,
            notes: reason ? `Cancelada: ${reason}` : "Cancelada pelo administrador"
          }
        }),
        ...appointment.appointmentRequests.map(request =>
          prisma.appointmentRequest.update({
            where: { id: request.id },
            data: { 
              status: AppointmentStatus.CANCELLED,
              notes: reason ? `Cancelada: ${reason}` : "Cancelada pelo administrador"
            }
          })
        )
      ]);

      // Criar notificação de cancelamento
      try {
        await NotificationService.createNotification({
          patientId: appointment.patientId,
          type: 'APPOINTMENT_CANCELLED',
          title: 'Consulta Cancelada ❌',
          message: `Sua consulta para ${appointment.date.toLocaleDateString()} às ${appointment.time} foi cancelada.
          
          Procedimento: ${appointment.notes || 'Não especificado'}
          Motivo: ${reason || 'Não especificado'}
          
          Entre em contato conosco para reagendar em outro horário disponível.`,
        });
      } catch (notificationError) {
        console.error("Erro ao criar notificação de cancelamento:", notificationError);
      }

      res.status(200).json({ message: "Consulta cancelada com sucesso." });
    } catch (error) {
      console.error("Erro ao cancelar consulta:", error);
      res.status(500).json({ error: "Erro ao cancelar consulta." });
    }
  }

  async updateAppointmentNotes(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { appointmentId } = req.params;
      const { notes } = req.body;

      const appointment = await prisma.appointment.findUnique({
        where: { id: parseInt(appointmentId) }
      });

      if (!appointment) {
        res.status(404).json({ error: "Consulta não encontrada." });
        return;
      }

      const updatedAppointment = await prisma.appointment.update({
        where: { id: parseInt(appointmentId) },
        data: { notes }
      });

      res.status(200).json(updatedAppointment);
    } catch (error) {
      console.error("Erro ao atualizar notas da consulta:", error);
      res.status(500).json({ error: "Erro ao atualizar notas da consulta." });
    }
  }

  async getAppointmentHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { patientId } = req.params;
      const authenticatedPatientId = req.patientId;

      // Verifica se o paciente está autenticado
      if (!authenticatedPatientId) {
        res.status(401).json({ message: 'Não autorizado' });
        return;
      }

      // Verifica se o paciente está tentando acessar seu próprio histórico
      if (authenticatedPatientId.toString() !== patientId) {
        res.status(403).json({ message: 'Acesso proibido' });
        return;
      }

      // Busca o histórico de consultas do paciente
      const appointments = await prisma.appointment.findMany({
        where: {
          patientId: parseInt(patientId),
          status: AppointmentStatus.CONFIRMED
        },
        orderBy: {
          date: 'desc'
        },
        include: {
          appointmentRequests: {
            select: {
              notes: true
            }
          }
        }
      });

      res.status(200).json(appointments);
    } catch (error) {
      console.error('Erro ao buscar histórico de consultas:', error);
      res.status(500).json({ message: 'Erro ao buscar histórico de consultas' });
    }
  }

  async getMyAppointmentHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const authenticatedPatientId = req.patientId;

      // Verifica se o paciente está autenticado
      if (!authenticatedPatientId) {
        res.status(401).json({ message: 'Não autorizado' });
        return;
      }

      // Busca o histórico de consultas do paciente autenticado
      const appointments = await prisma.appointment.findMany({
        where: {
          patientId: authenticatedPatientId,
          status: AppointmentStatus.CONFIRMED
        },
        orderBy: {
          date: 'desc'
        },
        include: {
          appointmentRequests: {
            select: {
              notes: true
            }
          }
        }
      });

      res.status(200).json(appointments);
    } catch (error) {
      console.error('Erro ao buscar histórico de consultas:', error);
      res.status(500).json({ message: 'Erro ao buscar histórico de consultas' });
    }
  }

  async getAvailableTimeSlots(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { date } = req.params;
      const selectedDate = new Date(date);

      // Buscar todos os horários ocupados para a data
      const occupiedAppointments = await prisma.appointment.findMany({
        where: { date: selectedDate },
        select: { time: true }
      });

      // Gerar todos os horários possíveis (exemplo: 8:00 às 18:00)
      const allTimeSlots = this.generateTimeSlots();
      
      // Filtrar horários disponíveis
      const availableSlots = allTimeSlots.filter(slot => 
        !occupiedAppointments.some(app => app.time === slot)
      );

      res.status(200).json(availableSlots);
    } catch (error) {
      console.error("Erro ao buscar horários disponíveis:", error);
      res.status(500).json({ error: "Erro ao buscar horários disponíveis." });
    }
  }

  async confirmAppointment(req: AuthRequest, res: Response): Promise<void> {
    try {
      console.log('🔍 ConfirmAppointment - Iniciando método');
      console.log('🔍 ConfirmAppointment - req.params:', req.params);
      console.log('🔍 ConfirmAppointment - req.body:', req.body);
      console.log('🔍 ConfirmAppointment - req.userId:', req.userId);
      console.log('🔍 ConfirmAppointment - req.isAdmin:', req.isAdmin);
      
      const { appointmentId } = req.params;
      console.log('Tentando confirmar agendamento:', { appointmentId });

      if (!appointmentId || isNaN(parseInt(appointmentId))) {
        console.log('❌ ID de agendamento inválido:', appointmentId);
        res.status(400).json({ error: "ID de agendamento inválido." });
        return;
      }

      // Primeiro, verificar se é uma solicitação pendente
      console.log('🔍 Buscando solicitação pendente com ID:', parseInt(appointmentId));
      const appointmentRequest = await prisma.appointmentRequest.findUnique({
        where: { id: parseInt(appointmentId) },
        include: { patient: true }
      });

      console.log('Solicitação encontrada:', appointmentRequest);

      if (appointmentRequest) {
        console.log('✅ Encontrou solicitação pendente, processando...');
        
        // Verificar se já não foi confirmada
        if (appointmentRequest.status === AppointmentStatus.CONFIRMED) {
          console.log('❌ Solicitação já confirmada');
          res.status(400).json({ error: "Esta solicitação já foi confirmada." });
          return;
        }

        // Verificar se o horário ainda está disponível
        console.log('🔍 Verificando disponibilidade do horário...');
        const isTimeSlotFree = await this.checkTimeSlotAvailability(
          appointmentRequest.patientId,
          appointmentRequest.requestedDate,
          appointmentRequest.requestedTime
        );
        
        console.log('🔍 Horário disponível:', isTimeSlotFree);
        
        if (!isTimeSlotFree) {
          console.log('❌ Horário já ocupado');
          res.status(409).json({ error: "O horário solicitado já está ocupado." });
          return;
        }

        // Verificar se está dentro do horário de funcionamento
        console.log('🔍 Verificando horário de funcionamento...');
        const isWithinWorkingHours = this.checkWorkingHours(
          appointmentRequest.requestedDate, 
          appointmentRequest.requestedTime
        );
        
        console.log('🔍 Dentro do horário de funcionamento:', isWithinWorkingHours);
        
        if (!isWithinWorkingHours) {
          console.log('❌ Fora do horário de funcionamento');
          res.status(400).json({ error: "O horário solicitado está fora do horário de funcionamento." });
          return;
        }

        console.log('✅ Todas as validações passaram, criando agendamento...');
        
        // Se for uma solicitação pendente, criar um novo agendamento
        const newAppointment = await prisma.appointment.create({
          data: {
            patientId: appointmentRequest.patientId,
            date: appointmentRequest.requestedDate,
            time: appointmentRequest.requestedTime,
            notes: appointmentRequest.notes,
            status: AppointmentStatus.CONFIRMED
          }
        });

        console.log('✅ Novo agendamento criado:', newAppointment);

        // Atualizar o status da solicitação
        await prisma.appointmentRequest.update({
          where: { id: parseInt(appointmentId) },
          data: { 
            status: AppointmentStatus.CONFIRMED,
            appointmentId: newAppointment.id
          }
        });

        console.log('✅ Status da solicitação atualizado');

        // Criar notificação de confirmação
        try {
          console.log('🔍 Criando notificações...');
          await NotificationService.createAppointmentConfirmation(
            appointmentRequest.patientId,
            {
              date: appointmentRequest.requestedDate,
              time: appointmentRequest.requestedTime,
              notes: appointmentRequest.notes,
            }
          );

          // Criar lembrete 24h antes
          await NotificationService.createAppointmentReminder(
            appointmentRequest.patientId,
            {
              date: appointmentRequest.requestedDate,
              time: appointmentRequest.requestedTime,
              notes: appointmentRequest.notes,
            }
          );
          console.log('✅ Notificações criadas com sucesso');
        } catch (notificationError) {
          console.error("Erro ao criar notificações:", notificationError);
          // Não falhar a confirmação se as notificações falharem
        }

        console.log('Novo agendamento criado:', newAppointment);
        res.status(200).json({ 
          message: "Agendamento confirmado com sucesso.",
          appointment: newAppointment
        });
        return;
      }

      console.log('🔍 Não encontrou solicitação pendente, buscando agendamento existente...');
      
      // Se não for uma solicitação pendente, verificar se é um agendamento existente
      const appointment = await prisma.appointment.findUnique({
        where: { id: parseInt(appointmentId) },
        include: { patient: true }
      });

      console.log('Agendamento existente encontrado:', appointment);

      if (!appointment) {
        console.log('❌ Agendamento não encontrado');
        res.status(404).json({ error: "Agendamento não encontrado." });
        return;
      }

      // Verificar se já não está confirmado
      if (appointment.status === AppointmentStatus.CONFIRMED) {
        console.log('❌ Agendamento já confirmado');
        res.status(400).json({ error: "Este agendamento já está confirmado." });
        return;
      }

      console.log('✅ Atualizando status do agendamento para CONFIRMED...');
      
      const updatedAppointment = await prisma.appointment.update({
        where: { id: parseInt(appointmentId) },
        data: { status: AppointmentStatus.CONFIRMED },
      });

      console.log('Agendamento atualizado:', updatedAppointment);

      res.status(200).json({ 
        message: "Agendamento confirmado com sucesso.",
        appointment: updatedAppointment
      });
    } catch (error) {
      console.error("Erro ao confirmar agendamento:", error);
      res.status(500).json({ error: "Erro interno do servidor ao confirmar agendamento." });
    }
  }

  private generateTimeSlots(): string[] {
    const slots: string[] = [];
    for (let hour = 8; hour <= 18; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  }

  private async checkTimeSlotAvailability(patientId: number, date: Date, time: string): Promise<boolean> {
    console.log('🔍 checkTimeSlotAvailability - Verificando disponibilidade:', {
      patientId,
      date,
      time
    });
    
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        date: date,
        time: time,
        status: {
          not: AppointmentStatus.CANCELLED
        }
      }
    });
    
    console.log('🔍 checkTimeSlotAvailability - Agendamento existente:', existingAppointment);
    const isAvailable = !existingAppointment;
    console.log('🔍 checkTimeSlotAvailability - Horário disponível:', isAvailable);
    
    return isAvailable;
  }

  private checkWorkingHours(date: Date, time: string): boolean {
    console.log('🔍 checkWorkingHours - Verificando horário de funcionamento:', {
      date,
      time
    });
    
    const [hours, minutes] = time.split(':').map(Number);
    const appointmentTime = new Date(date);
    appointmentTime.setHours(hours, minutes);

    const startTime = new Date(date);
    startTime.setHours(8, 0, 0); // 8:00 AM

    const endTime = new Date(date);
    endTime.setHours(18, 0, 0); // 6:00 PM

    const isWithinHours = appointmentTime >= startTime && appointmentTime <= endTime;
    
    console.log('🔍 checkWorkingHours - Resultado:', {
      appointmentTime: appointmentTime.toLocaleString(),
      startTime: startTime.toLocaleString(),
      endTime: endTime.toLocaleString(),
      isWithinHours
    });
    
    return isWithinHours;
  }
}

export default new AppointmentManagementController();