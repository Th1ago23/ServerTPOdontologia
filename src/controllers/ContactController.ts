import { Request, Response } from 'express';
import { sendContactEmail } from '../services/emailService';

export const sendContact = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Validação dos campos obrigatórios
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, preencha todos os campos obrigatórios'
      });
    }

    // Validação do formato do email
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

    const result = await sendContactEmail({
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
  } catch (error) {
    console.error('Erro no controlador de contato:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao enviar mensagem. Por favor, tente novamente mais tarde.',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}; 