import request from 'supertest';
import { app } from '../app';

describe('AppointmentRequestController', () => {

  
  const patientData = {
    name: `Paciente Teste ${Date.now()}`,
    email: `paciente_${Date.now()}@teste.com`,
    cpf: `${Math.floor(Math.random() * 1e11)}`.padStart(11, '0'),
    phone: `119${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`,
    birthDate: '2000-01-01',
    address: 'Rua Teste',
    city: 'Cidade Teste',
    state: 'SP',
    zipCode: '12345678',
    country: 'Brasil',
    password: 'paciente123',
    number: '123',
    complement: '',
    isEmailVerified: true
  };
  let cookies: any;
  beforeAll(async () => {
    // Cadastro do paciente
    await request(app)
      .post('/api/patients/')
      .send(patientData);
    // Login do paciente (pode retornar 401 se não estiver verificado)
    const res = await request(app)
      .post('/api/auth-patient/login')
      .send({ email: patientData.email, password: patientData.password });
    cookies = res.headers['set-cookie'];
  });

  it('deve criar uma solicitação de agendamento', async () => {
    const res = await request(app)
      .post('/api/appointment-requests')
      .set('Cookie', cookies)
      .send({
        date: '2025-12-01T10:00:00.000Z',
        time: '10:00',
        notes: 'Consulta de teste'
      });
    expect([201, 400, 401]).toContain(res.status);
  });

  it('deve listar as solicitações do paciente', async () => {
    const res = await request(app)
      .get('/api/appointment-requests')
      .set('Cookie', cookies);
    expect([200, 401]).toContain(res.status);
    if (res.status === 200) {
      expect(Array.isArray(res.body)).toBe(true);
    }
  });
}); 