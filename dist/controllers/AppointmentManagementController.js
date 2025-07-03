"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const notificationService_1 = require("../services/notificationService");
const prisma = new client_1.PrismaClient();
class AppointmentManagementController {
    async listPending(req, res) {
        try {
            const pendingRequests = await prisma.appointmentRequest.findMany({
                where: { status: client_1.AppointmentStatus.PENDING },
                include: { patient: true },
            });
            res.status(200).json(pendingRequests);
        }
        catch (error) {
            console.error("Erro ao listar solicitações pendentes:", error);
            res.status(500).json({ error: "Erro ao listar solicitações pendentes." });
        }
    }
    async listAllAppointmentRequests(req, res) {
        try {
            console.log('Debug - listAllAppointmentRequests chamado');
            console.log('Debug - req.userId:', req.userId);
            console.log('Debug - req.isAdmin:', req.isAdmin);
            console.log('Debug - req.userType:', req.userType);
            const { status } = req.query;
            console.log('Debug - status query:', status);
            const whereClause = {};
            if (status && status !== 'all') {
                whereClause.status = status;
            }
            console.log('Debug - whereClause:', whereClause);
            const requests = await prisma.appointmentRequest.findMany({
                where: whereClause,
                include: { patient: true },
                orderBy: { requestedDate: 'asc' },
            });
            console.log('Debug - requests encontradas:', requests.length);
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
            const requestsSerializadas = requests.map(request => {
                var _a, _b, _c, _d;
                return (Object.assign(Object.assign({}, request), { requestedDate: request.requestedDate.toISOString(), createdAt: request.createdAt.toISOString(), updatedAt: request.updatedAt.toISOString(), confirmedAt: ((_a = request.confirmedAt) === null || _a === void 0 ? void 0 : _a.toISOString()) || null, cancelledAt: ((_b = request.cancelledAt) === null || _b === void 0 ? void 0 : _b.toISOString()) || null, rescheduledAt: ((_c = request.rescheduledAt) === null || _c === void 0 ? void 0 : _c.toISOString()) || null, completedAt: ((_d = request.completedAt) === null || _d === void 0 ? void 0 : _d.toISOString()) || null }));
            });
            res.status(200).json(requestsSerializadas);
        }
        catch (error) {
            console.error("Erro ao listar solicitações de consulta:", error);
            res.status(500).json({ error: "Erro ao listar solicitações de consulta." });
        }
    }
    async approve(req, res) {
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
            if (appointmentRequest.status === client_1.AppointmentStatus.CONFIRMED) {
                console.log('❌ Solicitação já confirmada');
                res.status(400).json({ error: "Esta solicitação já foi confirmada." });
                return;
            }
            console.log('🔍 Verificando disponibilidade do horário...');
            const isTimeSlotFree = await this.checkTimeSlotAvailability(appointmentRequest.patientId, appointmentRequest.requestedDate, appointmentRequest.requestedTime);
            console.log('🔍 Horário disponível:', isTimeSlotFree);
            if (!isTimeSlotFree) {
                console.log('❌ Horário já ocupado');
                res.status(409).json({ error: "O horário solicitado já está ocupado." });
                return;
            }
            console.log('🔍 Verificando horário de funcionamento...');
            const isWithinWorkingHours = this.checkWorkingHours(appointmentRequest.requestedDate, appointmentRequest.requestedTime);
            console.log('🔍 Dentro do horário de funcionamento:', isWithinWorkingHours);
            if (!isWithinWorkingHours) {
                console.log('❌ Fora do horário de funcionamento');
                res.status(400).json({ error: "O horário solicitado está fora do horário de funcionamento." });
                return;
            }
            console.log('✅ Todas as validações passaram, criando agendamento...');
            const newAppointment = await prisma.appointment.create({
                data: {
                    patientId: appointmentRequest.patientId,
                    date: appointmentRequest.requestedDate,
                    time: appointmentRequest.requestedTime,
                    notes: appointmentRequest.notes,
                    status: client_1.AppointmentStatus.CONFIRMED
                },
            });
            console.log('✅ Novo agendamento criado:', newAppointment);
            await prisma.appointmentRequest.update({
                where: { id: parseInt(requestId) },
                data: {
                    status: client_1.AppointmentStatus.CONFIRMED,
                    appointmentId: newAppointment.id
                },
            });
            console.log('✅ Status da solicitação atualizado');
            try {
                console.log('🔍 Criando notificações...');
                await notificationService_1.NotificationService.createAppointmentConfirmation(appointmentRequest.patientId, {
                    date: appointmentRequest.requestedDate,
                    time: appointmentRequest.requestedTime,
                    notes: appointmentRequest.notes,
                });
                await notificationService_1.NotificationService.createAppointmentReminder(appointmentRequest.patientId, {
                    date: appointmentRequest.requestedDate,
                    time: appointmentRequest.requestedTime,
                    notes: appointmentRequest.notes,
                });
                console.log('✅ Notificações criadas com sucesso');
            }
            catch (notificationError) {
                console.error("Erro ao criar notificações:", notificationError);
            }
            console.log('✅ Aprovação concluída com sucesso');
            res.status(201).json({
                message: "Solicitação aprovada com sucesso.",
                appointment: newAppointment
            });
        }
        catch (error) {
            console.error("❌ Erro detalhado ao aprovar consulta:", {
                error,
                message: error.message,
                stack: error.stack
            });
            res.status(500).json({ error: "Erro interno do servidor ao aprovar consulta." });
        }
    }
    async reject(req, res) {
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
            if (appointmentRequest.status === client_1.AppointmentStatus.CANCELLED) {
                console.log('❌ Solicitação já cancelada');
                res.status(400).json({ error: "Esta solicitação já foi cancelada." });
                return;
            }
            console.log('✅ Atualizando status para CANCELLED...');
            await prisma.appointmentRequest.update({
                where: { id: parseInt(requestId) },
                data: { status: client_1.AppointmentStatus.CANCELLED },
            });
            console.log('✅ Status da solicitação atualizado');
            try {
                console.log('🔍 Criando notificação de rejeição...');
                await notificationService_1.NotificationService.createNotification({
                    patientId: appointmentRequest.patientId,
                    type: 'APPOINTMENT_CANCELLED',
                    title: 'Consulta Não Confirmada ❌',
                    message: `Infelizmente sua solicitação de consulta para ${appointmentRequest.requestedDate.toLocaleDateString()} às ${appointmentRequest.requestedTime} não pôde ser confirmada.
          
          Procedimento: ${appointmentRequest.notes || 'Não especificado'}
          
          Entre em contato conosco para reagendar em outro horário disponível.`,
                });
                console.log('✅ Notificação de rejeição criada com sucesso');
            }
            catch (notificationError) {
                console.error("Erro ao criar notificação de rejeição:", notificationError);
            }
            console.log('✅ Rejeição concluída com sucesso');
            res.status(200).json({ message: "Solicitação de consulta rejeitada com sucesso." });
        }
        catch (error) {
            console.error("❌ Erro detalhado ao rejeitar consulta:", {
                error,
                message: error.message,
                stack: error.stack
            });
            res.status(500).json({ error: "Erro interno do servidor ao rejeitar consulta." });
        }
    }
    async reschedule(req, res) {
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
            if (appointmentRequest.status === client_1.AppointmentStatus.CANCELLED) {
                res.status(400).json({ error: "Não é possível reagendar uma solicitação cancelada." });
                return;
            }
            const isNewTimeSlotFree = await this.checkTimeSlotAvailability(appointmentRequest.patientId, new Date(newDate), newTime);
            if (!isNewTimeSlotFree) {
                res.status(409).json({ error: "O novo horário selecionado já está ocupado." });
                return;
            }
            const isWithinWorkingHours = this.checkWorkingHours(new Date(newDate), newTime);
            if (!isWithinWorkingHours) {
                res.status(400).json({ error: "O novo horário selecionado está fora do horário de funcionamento (8:00 às 18:00)." });
                return;
            }
            const oldDate = appointmentRequest.requestedDate;
            const oldTime = appointmentRequest.requestedTime;
            const updatedRequest = await prisma.appointmentRequest.update({
                where: { id: parseInt(requestId) },
                data: {
                    requestedDate: new Date(newDate),
                    requestedTime: newTime,
                    status: client_1.AppointmentStatus.RESCHEDULED,
                    notes: notes || appointmentRequest.notes
                }
            });
            try {
                await notificationService_1.NotificationService.createNotification({
                    patientId: appointmentRequest.patientId,
                    type: 'APPOINTMENT_RESCHEDULED',
                    title: 'Consulta Reagendada! 📅',
                    message: `Sua consulta foi reagendada com sucesso!
          
          Data anterior: ${oldDate.toLocaleDateString()} às ${oldTime}
          Nova data: ${new Date(newDate).toLocaleDateString()} às ${newTime}
          
          Procedimento: ${notes || appointmentRequest.notes || 'Não especificado'}
          
          Aguardamos você no novo horário!`,
                });
            }
            catch (notificationError) {
                console.error("Erro ao criar notificação de reagendamento:", notificationError);
            }
            console.log('Solicitação reagendada com sucesso:', updatedRequest);
            res.status(200).json({
                message: "Solicitação de consulta reagendada com sucesso.",
                request: updatedRequest
            });
        }
        catch (error) {
            console.error("Erro ao reagendar consulta:", error);
            res.status(500).json({ error: "Erro interno do servidor ao reagendar consulta." });
        }
    }
    async listAllAppointments(req, res) {
        try {
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
            const pendingRequests = await prisma.appointmentRequest.findMany({
                where: {
                    status: client_1.AppointmentStatus.PENDING
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
                },
                orderBy: [
                    { requestedDate: 'asc' },
                    { requestedTime: 'asc' }
                ]
            });
            const allAppointments = [
                ...appointments.map(apt => ({
                    id: apt.id,
                    date: apt.date.toISOString(),
                    time: apt.time,
                    status: apt.status,
                    type: 'confirmed',
                    patient: apt.patient
                })),
                ...pendingRequests.map((req) => ({
                    id: req.id,
                    requestedDate: req.requestedDate.toISOString(),
                    requestedTime: req.requestedTime,
                    status: req.status,
                    type: 'pending',
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
        }
        catch (error) {
            console.error("Erro ao listar consultas:", error);
            res.status(500).json({ error: "Erro ao listar consultas." });
        }
    }
    async listAppointmentsByStatus(req, res) {
        try {
            const { status } = req.params;
            const appointments = await prisma.appointment.findMany({
                where: {
                    appointmentRequests: {
                        some: {
                            status: status
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
        }
        catch (error) {
            console.error("Erro ao listar consultas por status:", error);
            res.status(500).json({ error: "Erro ao listar consultas por status." });
        }
    }
    async listAppointmentsByDate(req, res) {
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
        }
        catch (error) {
            console.error("Erro ao listar consultas por data:", error);
            res.status(500).json({ error: "Erro ao listar consultas por data." });
        }
    }
    async getAppointmentDetails(req, res) {
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
        }
        catch (error) {
            console.error("Erro ao buscar detalhes da consulta:", error);
            res.status(500).json({ error: "Erro ao buscar detalhes da consulta." });
        }
    }
    async cancelAppointment(req, res) {
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
            await prisma.$transaction([
                prisma.appointment.update({
                    where: { id: parseInt(appointmentId) },
                    data: {
                        status: client_1.AppointmentStatus.CANCELLED,
                        notes: reason ? `Cancelada: ${reason}` : "Cancelada pelo administrador"
                    }
                }),
                ...appointment.appointmentRequests.map(request => prisma.appointmentRequest.update({
                    where: { id: request.id },
                    data: {
                        status: client_1.AppointmentStatus.CANCELLED,
                        notes: reason ? `Cancelada: ${reason}` : "Cancelada pelo administrador"
                    }
                }))
            ]);
            try {
                await notificationService_1.NotificationService.createNotification({
                    patientId: appointment.patientId,
                    type: 'APPOINTMENT_CANCELLED',
                    title: 'Consulta Cancelada ❌',
                    message: `Sua consulta para ${appointment.date.toLocaleDateString()} às ${appointment.time} foi cancelada.
          
          Procedimento: ${appointment.notes || 'Não especificado'}
          Motivo: ${reason || 'Não especificado'}
          
          Entre em contato conosco para reagendar em outro horário disponível.`,
                });
            }
            catch (notificationError) {
                console.error("Erro ao criar notificação de cancelamento:", notificationError);
            }
            res.status(200).json({ message: "Consulta cancelada com sucesso." });
        }
        catch (error) {
            console.error("Erro ao cancelar consulta:", error);
            res.status(500).json({ error: "Erro ao cancelar consulta." });
        }
    }
    async updateAppointmentNotes(req, res) {
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
        }
        catch (error) {
            console.error("Erro ao atualizar notas da consulta:", error);
            res.status(500).json({ error: "Erro ao atualizar notas da consulta." });
        }
    }
    async getAppointmentHistory(req, res) {
        try {
            const { patientId } = req.params;
            const authenticatedPatientId = req.patientId;
            if (!authenticatedPatientId) {
                res.status(401).json({ message: 'Não autorizado' });
                return;
            }
            if (authenticatedPatientId.toString() !== patientId) {
                res.status(403).json({ message: 'Acesso proibido' });
                return;
            }
            const appointments = await prisma.appointment.findMany({
                where: {
                    patientId: parseInt(patientId),
                    status: client_1.AppointmentStatus.CONFIRMED
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
        }
        catch (error) {
            console.error('Erro ao buscar histórico de consultas:', error);
            res.status(500).json({ message: 'Erro ao buscar histórico de consultas' });
        }
    }
    async getMyAppointmentHistory(req, res) {
        try {
            const authenticatedPatientId = req.patientId;
            if (!authenticatedPatientId) {
                res.status(401).json({ message: 'Não autorizado' });
                return;
            }
            const appointments = await prisma.appointment.findMany({
                where: {
                    patientId: authenticatedPatientId,
                    status: client_1.AppointmentStatus.CONFIRMED
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
        }
        catch (error) {
            console.error('Erro ao buscar histórico de consultas:', error);
            res.status(500).json({ message: 'Erro ao buscar histórico de consultas' });
        }
    }
    async getAvailableTimeSlots(req, res) {
        try {
            const { date } = req.params;
            const selectedDate = new Date(date);
            const occupiedAppointments = await prisma.appointment.findMany({
                where: { date: selectedDate },
                select: { time: true }
            });
            const allTimeSlots = this.generateTimeSlots();
            const availableSlots = allTimeSlots.filter(slot => !occupiedAppointments.some(app => app.time === slot));
            res.status(200).json(availableSlots);
        }
        catch (error) {
            console.error("Erro ao buscar horários disponíveis:", error);
            res.status(500).json({ error: "Erro ao buscar horários disponíveis." });
        }
    }
    async confirmAppointment(req, res) {
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
            console.log('🔍 Buscando solicitação pendente com ID:', parseInt(appointmentId));
            const appointmentRequest = await prisma.appointmentRequest.findUnique({
                where: { id: parseInt(appointmentId) },
                include: { patient: true }
            });
            console.log('Solicitação encontrada:', appointmentRequest);
            if (appointmentRequest) {
                console.log('✅ Encontrou solicitação pendente, processando...');
                if (appointmentRequest.status === client_1.AppointmentStatus.CONFIRMED) {
                    console.log('❌ Solicitação já confirmada');
                    res.status(400).json({ error: "Esta solicitação já foi confirmada." });
                    return;
                }
                console.log('🔍 Verificando disponibilidade do horário...');
                const isTimeSlotFree = await this.checkTimeSlotAvailability(appointmentRequest.patientId, appointmentRequest.requestedDate, appointmentRequest.requestedTime);
                console.log('🔍 Horário disponível:', isTimeSlotFree);
                if (!isTimeSlotFree) {
                    console.log('❌ Horário já ocupado');
                    res.status(409).json({ error: "O horário solicitado já está ocupado." });
                    return;
                }
                console.log('🔍 Verificando horário de funcionamento...');
                const isWithinWorkingHours = this.checkWorkingHours(appointmentRequest.requestedDate, appointmentRequest.requestedTime);
                console.log('🔍 Dentro do horário de funcionamento:', isWithinWorkingHours);
                if (!isWithinWorkingHours) {
                    console.log('❌ Fora do horário de funcionamento');
                    res.status(400).json({ error: "O horário solicitado está fora do horário de funcionamento." });
                    return;
                }
                console.log('✅ Todas as validações passaram, criando agendamento...');
                const newAppointment = await prisma.appointment.create({
                    data: {
                        patientId: appointmentRequest.patientId,
                        date: appointmentRequest.requestedDate,
                        time: appointmentRequest.requestedTime,
                        notes: appointmentRequest.notes,
                        status: client_1.AppointmentStatus.CONFIRMED
                    }
                });
                console.log('✅ Novo agendamento criado:', newAppointment);
                await prisma.appointmentRequest.update({
                    where: { id: parseInt(appointmentId) },
                    data: {
                        status: client_1.AppointmentStatus.CONFIRMED,
                        appointmentId: newAppointment.id
                    }
                });
                console.log('✅ Status da solicitação atualizado');
                try {
                    console.log('🔍 Criando notificações...');
                    await notificationService_1.NotificationService.createAppointmentConfirmation(appointmentRequest.patientId, {
                        date: appointmentRequest.requestedDate,
                        time: appointmentRequest.requestedTime,
                        notes: appointmentRequest.notes,
                    });
                    await notificationService_1.NotificationService.createAppointmentReminder(appointmentRequest.patientId, {
                        date: appointmentRequest.requestedDate,
                        time: appointmentRequest.requestedTime,
                        notes: appointmentRequest.notes,
                    });
                    console.log('✅ Notificações criadas com sucesso');
                }
                catch (notificationError) {
                    console.error("Erro ao criar notificações:", notificationError);
                }
                console.log('Novo agendamento criado:', newAppointment);
                res.status(200).json({
                    message: "Agendamento confirmado com sucesso.",
                    appointment: newAppointment
                });
                return;
            }
            console.log('🔍 Não encontrou solicitação pendente, buscando agendamento existente...');
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
            if (appointment.status === client_1.AppointmentStatus.CONFIRMED) {
                console.log('❌ Agendamento já confirmado');
                res.status(400).json({ error: "Este agendamento já está confirmado." });
                return;
            }
            console.log('✅ Atualizando status do agendamento para CONFIRMED...');
            const updatedAppointment = await prisma.appointment.update({
                where: { id: parseInt(appointmentId) },
                data: { status: client_1.AppointmentStatus.CONFIRMED },
            });
            console.log('Agendamento atualizado:', updatedAppointment);
            res.status(200).json({
                message: "Agendamento confirmado com sucesso.",
                appointment: updatedAppointment
            });
        }
        catch (error) {
            console.error("Erro ao confirmar agendamento:", error);
            res.status(500).json({ error: "Erro interno do servidor ao confirmar agendamento." });
        }
    }
    generateTimeSlots() {
        const slots = [];
        for (let hour = 8; hour <= 18; hour++) {
            slots.push(`${hour.toString().padStart(2, '0')}:00`);
            slots.push(`${hour.toString().padStart(2, '0')}:30`);
        }
        return slots;
    }
    async checkTimeSlotAvailability(patientId, date, time) {
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
                    not: client_1.AppointmentStatus.CANCELLED
                }
            }
        });
        console.log('🔍 checkTimeSlotAvailability - Agendamento existente:', existingAppointment);
        const isAvailable = !existingAppointment;
        console.log('🔍 checkTimeSlotAvailability - Horário disponível:', isAvailable);
        return isAvailable;
    }
    checkWorkingHours(date, time) {
        console.log('🔍 checkWorkingHours - Verificando horário de funcionamento:', {
            date,
            time
        });
        const [hours, minutes] = time.split(':').map(Number);
        const appointmentTime = new Date(date);
        appointmentTime.setHours(hours, minutes);
        const startTime = new Date(date);
        startTime.setHours(8, 0, 0);
        const endTime = new Date(date);
        endTime.setHours(18, 0, 0);
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
exports.default = new AppointmentManagementController();
