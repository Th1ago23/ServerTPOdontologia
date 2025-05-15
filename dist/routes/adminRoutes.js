"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const AppointmentManagementController_1 = __importDefault(require("../controllers/AppointmentManagementController"));
const router = (0, express_1.Router)();
// Middleware de autenticação para todas as rotas
router.use(authMiddleware_1.authenticateToken);
// Rotas de gerenciamento de consultas
router.get("/appointments", AppointmentManagementController_1.default.listAllAppointments);
router.get("/appointments/status/:status", AppointmentManagementController_1.default.listAppointmentsByStatus);
router.get("/appointments/date/:date", AppointmentManagementController_1.default.listAppointmentsByDate);
router.get("/appointments/patient/:patientId/history", AppointmentManagementController_1.default.getAppointmentHistory);
router.get("/appointments/available-slots/:date", AppointmentManagementController_1.default.getAvailableTimeSlots);
// Rotas de gerenciamento de solicitações
router.get("/requests/pending", AppointmentManagementController_1.default.listPending);
router.post("/requests/:requestId/approve", AppointmentManagementController_1.default.approve);
router.post("/requests/:requestId/reject", AppointmentManagementController_1.default.reject);
router.post("/requests/:requestId/reschedule", AppointmentManagementController_1.default.reschedule);
// Rotas de gerenciamento de consultas existentes
router.post("/appointments/:appointmentId/cancel", AppointmentManagementController_1.default.cancelAppointment);
router.put("/appointments/:appointmentId/notes", AppointmentManagementController_1.default.updateAppointmentNotes);
router.get("/appointments/:appointmentId", AppointmentManagementController_1.default.getAppointmentDetails);
router.put("/appointments/:appointmentId/confirm", AppointmentManagementController_1.default.confirmAppointment);
exports.default = router;
