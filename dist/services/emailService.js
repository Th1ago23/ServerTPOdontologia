"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendContactEmail = exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
let transporter = null;
try {
    if (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS) {
        transporter = nodemailer_1.default.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT),
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
        console.log('Configurações SMTP:', {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            user: process.env.SMTP_USER,
            from: process.env.SMTP_FROM,
            contactEmail: process.env.CONTACT_EMAIL,
        });
        transporter.verify(function (error, success) {
            if (error) {
                console.error('Erro na configuração do SMTP:', error);
                transporter = null;
            }
            else {
                console.log('Servidor SMTP está pronto para enviar emails');
            }
        });
    }
    else {
        console.log('Configurações SMTP não encontradas, emails serão simulados');
    }
}
catch (error) {
    console.error('Erro ao configurar SMTP:', error);
    transporter = null;
}
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true' && transporter !== null;
const sendEmail = async (data) => {
    if (!EMAIL_ENABLED) {
        console.log('Email desabilitado ou SMTP não configurado. Configurações necessárias:');
        console.log('- SMTP_HOST');
        console.log('- SMTP_PORT');
        console.log('- SMTP_USER');
        console.log('- SMTP_PASS');
        console.log('- SMTP_FROM');
        console.log('- EMAIL_ENABLED=true');
        throw new Error('Serviço de email não está configurado corretamente');
    }
    try {
        if (!data.to) {
            throw new Error('Email de destino não configurado');
        }
        const mailOptions = {
            from: process.env.SMTP_FROM || 'noreply@tpodontologia.com',
            to: data.to,
            subject: data.subject,
            text: data.text,
            html: data.html,
        };
        console.log('Tentando enviar email com as opções:', {
            from: mailOptions.from,
            to: mailOptions.to,
            subject: mailOptions.subject,
        });
        if (!transporter) {
            throw new Error('Transporter SMTP não configurado');
        }
        const info = await transporter.sendMail(mailOptions);
        console.log('Email enviado com sucesso:', info.messageId);
        return { success: true, messageId: info.messageId };
    }
    catch (error) {
        console.error('Erro detalhado ao enviar email:', error);
        throw error;
    }
};
exports.sendEmail = sendEmail;
const sendContactEmail = async (data) => {
    try {
        if (!process.env.CONTACT_EMAIL) {
            throw new Error('Email de contato não configurado no ambiente');
        }
        const emailText = `
      Nome: ${data.name}
      Email: ${data.email}
      Telefone: ${data.phone}
      Assunto: ${data.subject}
      
      Mensagem:
      ${data.message}
    `;
        const emailHtml = `
      <h2>Novo contato recebido</h2>
      <p><strong>Nome:</strong> ${data.name}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p><strong>Telefone:</strong> ${data.phone}</p>
      <p><strong>Assunto:</strong> ${data.subject}</p>
      <p><strong>Mensagem:</strong></p>
      <p>${data.message}</p>
    `;
        return (0, exports.sendEmail)({
            to: process.env.CONTACT_EMAIL,
            subject: `Novo contato: ${data.subject}`,
            text: emailText,
            html: emailHtml,
        });
    }
    catch (error) {
        console.error('Erro ao processar email de contato:', error);
        throw error;
    }
};
exports.sendContactEmail = sendContactEmail;
