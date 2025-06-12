import { sendEmail } from '../services/emailService';

describe('Teste de envio de e-mail', () => {
  it('deve enviar um e-mail de teste para thiago.peixots@gmail.com sem lançar erro', async () => {
    await expect(
      sendEmail({
        to: 'thiago.peixots@gmail.com',
        subject: 'Teste automatizado de envio de e-mail',
        text: 'Este é um teste automatizado do serviço de e-mail.',
        html: '<h2>Teste automatizado</h2><p>Este é um teste automatizado do serviço de e-mail.</p>'
      })
    ).resolves.not.toThrow();
  });
}); 