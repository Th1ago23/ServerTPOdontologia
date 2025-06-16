import request from 'supertest';
import {app} from '../app';
import { prisma } from './setup';

describe('Fluxo completo do backend', () => {
  let patientToken: string;
  let adminToken: string;
  let appointmentRequestId: number;
  let patientId: number;

  beforeAll(async () => {
    try {
      await prisma.patient.deleteMany();
      await prisma.user.deleteMany();
      await prisma.appointmentRequest.deleteMany();
    } catch (error) {
      console.error('Erro ao limpar banco de dados:', error);
    }
  });

  afterAll(async () => {
    try {
      await prisma.patient.deleteMany();
      await prisma.user.deleteMany();
      await prisma.appointmentRequest.deleteMany();
      await prisma.$disconnect();
    } catch (error) {
      console.error('Erro ao limpar banco de dados:', error);
    }
  });

  const patientData = {
    name: 'Paciente Teste',
    email: `paciente${Date.now()}@teste.com`,
    password: '123456',
    phone: '11999999999',
    birthDate: '2000-01-01',
    cpf: '12345678901'
  };

  const adminData = {
    email: 'admin@teste.com',
    password: 'admin123'
  };

  it('Deve cadastrar um novo paciente', async () => {
    const res = await request(app)
      .post('/api/patients/register')
      .send(patientData)
      .redirects(1);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    patientId = res.body.id;
  });

  it('Deve fazer login do paciente', async () => {
    const res = await request(app)
      .post('/api/auth-patient/login')
      .send({ email: patientData.email, password: patientData.password })
      .redirects(1);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    patientToken = res.body.accessToken;
  });

  it('Deve fazer login do admin', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send(adminData)
      .redirects(1);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    adminToken = res.body.accessToken;
  });

  it('Paciente deve criar uma solicitação de agendamento', async () => {
    const res = await request(app)
      .post('/api/appointment-requests')
      .set('Cookie', [`accessToken=${patientToken}`])
      .send({
        date: '2025-12-01T10:00:00.000Z',
        description: 'Consulta de teste'
      })
      .redirects(1);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    appointmentRequestId = res.body.id;
  });

  it('Paciente deve listar suas solicitações de agendamento', async () => {
    const res = await request(app)
      .get('/api/appointment-requests')
      .set('Cookie', [`accessToken=${patientToken}`])
      .redirects(1);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('Admin deve aprovar a solicitação de agendamento', async () => {
    const res = await request(app)
      .patch(`/api/appointments/${appointmentRequestId}/approve`)
      .set('Cookie', [`accessToken=${adminToken}`])
      .redirects(1);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
  });

  it('Paciente deve ver o histórico de consultas', async () => {
    const res = await request(app)
      .get(`/api/appointments/history/${patientId}`)
      .set('Cookie', [`accessToken=${patientToken}`])
      .redirects(1);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
}); 