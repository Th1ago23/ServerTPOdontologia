import { Router } from "express";
import { authenticateToken, authenticateAdmin } from "../middleware/authMiddleware";
import AppointmentManagementController from "../controllers/AppointmentManagementController";

const router = Router();

// Middleware de autenticação para todas as rotas
router.use(authenticateToken, authenticateAdmin);

// Rotas de gerenciamento de consultas
router.get("/appointments", AppointmentManagementController.listAllAppointments);
router.get("/appointments/status/:status", AppointmentManagementController.listAppointmentsByStatus);
router.get("/appointments/date/:date", AppointmentManagementController.listAppointmentsByDate);
router.get("/appointments/patient/:patientId/history", AppointmentManagementController.getAppointmentHistory);
router.get("/appointments/available-slots/:date", AppointmentManagementController.getAvailableTimeSlots);

// Rotas de gerenciamento de solicitações
router.get("/appointment-requests", AppointmentManagementController.listAllAppointmentRequests.bind(AppointmentManagementController));
router.get("/requests/pending", AppointmentManagementController.listPending);
router.post("/requests/:requestId/approve", AppointmentManagementController.approve);
router.post("/requests/:requestId/reject", AppointmentManagementController.reject);
router.post("/requests/:requestId/reschedule", AppointmentManagementController.reschedule);

// Rotas de gerenciamento de consultas existentes
router.post("/appointments/:appointmentId/cancel", AppointmentManagementController.cancelAppointment);
router.put("/appointments/:appointmentId/notes", AppointmentManagementController.updateAppointmentNotes);
router.get("/appointments/:appointmentId", AppointmentManagementController.getAppointmentDetails);
router.put("/appointments/:appointmentId/confirm", AppointmentManagementController.confirmAppointment);

export default router;