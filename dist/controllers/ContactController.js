"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendContact = void 0;
const emailService_1 = require("../services/emailService");
const sendContact = async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;
        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'Por favor, preencha todos os campos obrigatórios'
            });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Por favor, forneça um email válido'
            });
        }
        console.log('Recebendo solicitação de contato:', {
            name,
            email,
            phone,
            subject
        });
        const result = await (0, emailService_1.sendContactEmail)({
            name,
            email,
            phone,
            subject,
            message
        });
        console.log('Resultado do envio:', result);
        return res.status(200).json({
            success: true,
            message: 'Mensagem enviada com sucesso!'
        });
    }
    catch (error) {
        console.error('Erro no controlador de contato:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro ao enviar mensagem. Por favor, tente novamente mais tarde.',
            error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
};
exports.sendContact = sendContact;
