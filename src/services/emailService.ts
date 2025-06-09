import nodemailer from 'nodemailer';

// Configuração do transporter do nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verificar configurações do SMTP
console.log('Configurações SMTP:', {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER,
  from: process.env.SMTP_FROM,
  contactEmail: process.env.CONTACT_EMAIL,
});

// Verificar se o transporter foi criado corretamente
transporter.verify(function(error, success) {
  if (error) {
    console.error('Erro na configuração do SMTP:', error);
  } else {
    console.log('Servidor SMTP está pronto para enviar emails');
  }
});

interface EmailData {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true';

export const sendEmail = async (data: EmailData) => {
  if (!EMAIL_ENABLED) {
    console.log('Simulação de envio de e-mail:', data);
    return { success: true, messageId: 'simulado' };
  }

  try {
    // Verificar se o email de destino está configurado
    if (!data.to) {
      throw new Error('Email de destino não configurado');
    }

    const mailOptions = {
      from: process.env.SMTP_FROM,
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

    const info = await transporter.sendMail(mailOptions);
    console.log('Email enviado com sucesso:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Erro detalhado ao enviar email:', error);
    throw new Error(`Falha ao enviar email: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
};

// Função específica para enviar email de contato
export const sendContactEmail = async (data: {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}) => {
  try {
    // Verificar se o email de contato está configurado
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

    return sendEmail({
      to: process.env.CONTACT_EMAIL,
      subject: `Novo contato: ${data.subject}`,
      text: emailText,
      html: emailHtml,
    });
  } catch (error) {
    console.error('Erro ao processar email de contato:', error);
    throw error;
  }
}; 