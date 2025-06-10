import request from 'supertest';
import { app } from '../app';
import { clearDatabase, prisma, createTestUser, createTestPatient } from '../tests/utils';
import { createVerificationCode } from '../services/verificationService';
import bcrypt from 'bcryptjs';

// Hooks globais
beforeAll(async () => {
  await prisma.patient.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.patient.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

describe('Auth Controller', () => {
  let testUser: any;
  let testPatient: any;

  beforeEach(async () => {
    await clearDatabase(); // Limpa o banco antes de cada teste
    testUser = await createTestUser();
    testPatient = await createTestPatient();
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid admin credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should login successfully with valid patient credentials', async () => {
      const response = await request(app)
        .post('/api/auth-patient/login')
        .send({
          email: 'patient@example.com',
          password: 'testpassword',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should return 401 with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      // Primeiro faz login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword',
        });

      const cookies = loginResponse.headers['set-cookie'];

      // Tenta fazer logout
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Logout realizado com sucesso');
    });
  });

  describe('POST /api/auth/verify-email', () => {
    it('should verify email with valid code', async () => {
      // Primeiro faz login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword',
        });

      const cookies = loginResponse.headers['set-cookie'];

      // Gera o código de verificação
      await createVerificationCode(testUser.email, false);

      // Busca o código de verificação salvo no banco
      const userInDb = await prisma.user.findUnique({ where: { email: testUser.email } });
      console.log('Código salvo:', userInDb?.emailVerificationCode, 'para o e-mail:', testUser.email);
      const code = userInDb?.emailVerificationCode;
      expect(code).toBeDefined();

      // Tenta verificar email
      const response = await request(app)
        .post('/api/auth/verify-email')
        .set('Cookie', cookies)
        .send({
          code: code,
          email: 'test@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'E-mail verificado com sucesso');
    });

    it('should not verify email with invalid code', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'testpassword' });
      const cookies = loginResponse.headers['set-cookie'];
      await createVerificationCode(testUser.email, false);
      const response = await request(app)
        .post('/api/auth/verify-email')
        .set('Cookie', cookies)
        .send({ code: '000000', email: testUser.email });
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Código de verificação inválido');
    });

    it('should not verify email with expired code', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'testpassword' });
      const cookies = loginResponse.headers['set-cookie'];
      await createVerificationCode(testUser.email, false);
      // Expira o código manualmente
      await prisma.user.update({
        where: { email: testUser.email },
        data: { emailVerificationExpires: new Date(Date.now() - 3600000) },
      });
      const userInDb = await prisma.user.findUnique({ where: { email: testUser.email } });
      const code = userInDb?.emailVerificationCode;
      const response = await request(app)
        .post('/api/auth/verify-email')
        .set('Cookie', cookies)
        .send({ code, email: testUser.email });
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Código de verificação expirado');
    });

    it('should not verify email if no code was generated', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'testpassword' });
      const cookies = loginResponse.headers['set-cookie'];
      // Remove qualquer código existente
      await prisma.user.update({
        where: { email: testUser.email },
        data: { emailVerificationCode: null, emailVerificationExpires: null },
      });
      const response = await request(app)
        .post('/api/auth/verify-email')
        .set('Cookie', cookies)
        .send({ code: '123456', email: testUser.email });
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Código de verificação não encontrado');
    });

    it('should verify patient email with valid code', async () => {
      const loginResponse = await request(app)
        .post('/api/auth-patient/login')
        .send({ email: testPatient.email, password: 'testpassword' });
      const cookies = loginResponse.headers['set-cookie'];
      await createVerificationCode(testPatient.email, true);
      const patientInDb = await prisma.patient.findUnique({ where: { email: testPatient.email } });
      const code = patientInDb?.emailVerificationCode;
      expect(code).toBeDefined();
      const response = await request(app)
        .post('/api/auth/verify-email')
        .set('Cookie', cookies)
        .send({ code, isPatient: true, email: testPatient.email });
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'E-mail verificado com sucesso');
    });
  });

  describe('Admin route access control', () => {
    beforeAll(async () => {
      // Limpa usuários e pacientes de teste
      await prisma.user.deleteMany({ where: { email: 'test@example.com' } });
      await prisma.patient.deleteMany({ where: { email: 'patient@example.com' } });
      await createTestUser();
      await createTestPatient();
    });

    it('should allow admin to access admin panel route', async () => {
      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'testpassword' });
      const adminCookies = Array.isArray(adminLogin.headers['set-cookie']) ? adminLogin.headers['set-cookie'] : [adminLogin.headers['set-cookie']];
      const response = await request(app)
        .get('/api/admin/appointments')
        .set('Cookie', adminCookies);
      expect(response.status).toBe(200);
    });

    it('should forbid patient from accessing admin panel route', async () => {
      const patientLogin = await request(app)
        .post('/api/auth-patient/login')
        .send({ email: 'patient@example.com', password: 'testpassword' });
      const patientCookies = Array.isArray(patientLogin.headers['set-cookie']) ? patientLogin.headers['set-cookie'] : [patientLogin.headers['set-cookie']];
      const response = await request(app)
        .get('/api/admin/appointments')
        .set('Cookie', patientCookies);
      expect(response.status).toBe(403);
    });
  });
}); 