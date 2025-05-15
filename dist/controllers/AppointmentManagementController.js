"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
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
    async approve(req, res) {
        try {
            const { requestId } = req.params;
            const appointmentRequest = await prisma.appointmentRequest.findUnique({
                where: { id: parseInt(requestId) },
            });
            if (!appointmentRequest) {
                res.status(404).json({ error: "Solicitação não encontrada." });
                return;
            }
            // *** Lógica de Negócios Adicional ***
            const isTimeSlotFree = await this.checkTimeSlotAvailability(appointmentRequest.patientId, appointmentRequest.date, appointmentRequest.time);
            if (!isTimeSlotFree) {
                res.status(409).json({ error: "O horário solicitado já está ocupado." });
                return;
            }
            // 2. Verificar se o horário está dentro do horário de funcionamento (se aplicável)
            const isWithinWorkingHours = this.checkWorkingHours(appointmentRequest.date, appointmentRequest.time);
            if (!isWithinWorkingHours) {
                res.status(400).json({ error: "O horário solicitado está fora do horário de funcionamento." });
                return;
            }
            // Criar a consulta real
            const newAppointment = await prisma.appointment.create({
                data: {
                    patientId: appointmentRequest.patientId,
                    date: appointmentRequest.date,
                    time: appointmentRequest.time,
                    notes: appointmentRequest.notes,
                },
            });
            // Atualizar o status da solicitação
            await prisma.appointmentRequest.update({
                where: { id: parseInt(requestId) },
                data: { status: client_1.AppointmentStatus.CONFIRMED, appointmentId: newAppointment.id },
            });
            res.status(201).json(newAppointment);
        }
        catch (error) {
            console.error("Erro ao aprovar consulta:", error);
            res.status(500).json({ error: "Erro ao aprovar consulta." });
        }
    }
    async reject(req, res) {
        try {
            const { requestId } = req.params;
            const appointmentRequest = await prisma.appointmentRequest.findUnique({
                where: { id: parseInt(requestId) },
            });
            if (!appointmentRequest) {
                res.status(404).json({ error: "Solicitação não encontrada." });
                return;
            }
            await prisma.appointmentRequest.update({
                where: { id: parseInt(requestId) },
                data: { status: client_1.AppointmentStatus.CANCELLED },
            });
            res.status(200).json({ message: "Solicitação de consulta rejeitada com sucesso." });
        }
        catch (error) {
            console.error("Erro ao rejeitar consulta:", error);
            res.status(500).json({ error: "Erro ao rejeitar consulta." });
        }
    }
    async reschedule(req, res) {
        try {
            const { requestId } = req.params;
            const { newDate, newTime } = req.body;
            const appointmentRequest = await prisma.appointmentRequest.findUnique({
                where: { id: parseInt(requestId) },
            });
            if (!appointmentRequest) {
                res.status(404).json({ error: "Solicitação não encontrada." });
                return;
            }
            // *** Lógica de Negócios Adicional para Reagendamento ***
            // 1. Verificar disponibilidade para a nova data e hora
            const isNewTimeSlotFree = await this.checkTimeSlotAvailability(appointmentRequest.patientId, new Date(newDate), newTime);
            if (!isNewTimeSlotFree) {
                res.status(409).json({ error: "O novo horário selecionado já está ocupado." });
                return;
            }
            // 2. Verificar se o novo horário está dentro do horário de funcionamento
            const isWithinWorkingHours = this.checkWorkingHours(new Date(newDate), newTime);
            if (!isWithinWorkingHours) {
                res.status(400).json({ error: "O novo horário selecionado está fora do horário de funcionamento." });
                return;
            }
            await prisma.appointmentRequest.update({
                where: { id: parseInt(requestId) },
                data: { date: new Date(newDate), time: newTime, status: client_1.AppointmentStatus.RESCHEDULED },
            });
            res.status(200).json({ message: "Solicitação de consulta reagendada com sucesso." });
        }
        catch (error) {
            console.error("Erro ao reagendar consulta:", error);
            res.status(500).json({ error: "Erro ao reagendar consulta." });
        }
    }
    // Novos métodos para o app mobile
    async listAllAppointments(req, res) {
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
                orderBy: [
                    { date: 'asc' },
                    { time: 'asc' }
                ]
            });
            // Buscar solicitações pendentes
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
                    { date: 'asc' },
                    { time: 'asc' }
                ]
            });
            // Combinar os resultados
            const allAppointments = [
                ...appointments.map(apt => ({
                    id: apt.id,
                    date: apt.date,
                    time: apt.time,
                    status: apt.status,
                    type: 'confirmed',
                    patient: apt.patient
                })),
                ...pendingRequests.map(req => ({
                    id: req.id,
                    date: req.date,
                    time: req.time,
                    status: req.status,
                    type: 'pending',
                    patient: req.patient
                }))
            ].sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                if (dateA.getTime() === dateB.getTime()) {
                    return a.time.localeCompare(b.time);
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
                orderBy: [
                    { date: 'asc' },
                    { time: 'asc' }
                ]
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
                orderBy: {
                    time: 'asc'
                }
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
                include: { appointmentRequests: true }
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
            const appointments = await prisma.appointment.findMany({
                where: { patientId: parseInt(patientId) },
                include: {
                    appointmentRequests: true
                },
                orderBy: [
                    { date: 'desc' },
                    { time: 'desc' }
                ]
            });
            res.status(200).json(appointments);
        }
        catch (error) {
            console.error("Erro ao buscar histórico de consultas:", error);
            res.status(500).json({ error: "Erro ao buscar histórico de consultas." });
        }
    }
    async getAvailableTimeSlots(req, res) {
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
            const { appointmentId } = req.params;
            console.log('Tentando confirmar agendamento:', { appointmentId });
            // Primeiro, verificar se é uma solicitação pendente
            const appointmentRequest = await prisma.appointmentRequest.findUnique({
                where: { id: parseInt(appointmentId) },
            });
            console.log('Solicitação encontrada:', appointmentRequest);
            if (appointmentRequest) {
                // Se for uma solicitação pendente, criar um novo agendamento
                const newAppointment = await prisma.appointment.create({
                    data: {
                        patientId: appointmentRequest.patientId,
                        date: appointmentRequest.date,
                        time: appointmentRequest.time,
                        notes: appointmentRequest.notes,
                        status: client_1.AppointmentStatus.CONFIRMED
                    }
                });
                // Atualizar o status da solicitação
                await prisma.appointmentRequest.update({
                    where: { id: parseInt(appointmentId) },
                    data: {
                        status: client_1.AppointmentStatus.CONFIRMED,
                        appointmentId: newAppointment.id
                    }
                });
                console.log('Novo agendamento criado:', newAppointment);
                res.status(200).json({ message: "Agendamento confirmado com sucesso." });
                return;
            }
            // Se não for uma solicitação pendente, verificar se é um agendamento existente
            const appointment = await prisma.appointment.findUnique({
                where: { id: parseInt(appointmentId) },
            });
            console.log('Agendamento existente encontrado:', appointment);
            if (!appointment) {
                res.status(404).json({ error: "Agendamento não encontrado." });
                return;
            }
            const updatedAppointment = await prisma.appointment.update({
                where: { id: parseInt(appointmentId) },
                data: { status: client_1.AppointmentStatus.CONFIRMED },
            });
            console.log('Agendamento atualizado:', updatedAppointment);
            res.status(200).json({ message: "Agendamento confirmado com sucesso." });
        }
        catch (error) {
            console.error("Erro ao confirmar agendamento:", error);
            res.status(500).json({ error: "Erro ao confirmar agendamento." });
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
        const existingAppointment = await prisma.appointment.findFirst({
            where: {
                date,
                time,
                patientId
            }
        });
        return !existingAppointment;
    }
    checkWorkingHours(date, time) {
        const [hours, minutes] = time.split(':').map(Number);
        const appointmentTime = new Date(date);
        appointmentTime.setHours(hours, minutes);
        const startTime = new Date(date);
        startTime.setHours(8, 0, 0); // 8:00 AM
        const endTime = new Date(date);
        endTime.setHours(18, 0, 0); // 6:00 PM
        return appointmentTime >= startTime && appointmentTime <= endTime;
    }
}
exports.default = new AppointmentManagementController();
