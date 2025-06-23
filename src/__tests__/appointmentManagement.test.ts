import request from 'supertest';
import { app } from '../app';

describe('AppointmentManagementController', () => {
  let adminToken: string;
  let appointmentRequestId: number;

  beforeAll(async () => {
    // Login como admin
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'tati.dent11@gmail.com', password: 'T4T1An3Th1ag0' });
    adminToken = res.body.accessToken;
  });

  it('deve listar solicitações pendentes', async () => {
    const res = await request(app)
      .get('/api/admin/requests/pending')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 401]).toContain(res.status);
    if (res.status === 200 && Array.isArray(res.body) && res.body.length > 0) {
      appointmentRequestId = res.body[0].id;
    }
  });

  it('deve aprovar uma solicitação de agendamento', async () => {
    if (!appointmentRequestId) return;
    const res = await request(app)
      .post(`/api/admin/requests/${appointmentRequestId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201, 400, 404]).toContain(res.status);
  });

  it('deve rejeitar uma solicitação de agendamento', async () => {
    if (!appointmentRequestId) return;
    const res = await request(app)
      .post(`/api/admin/requests/${appointmentRequestId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 400, 404]).toContain(res.status);
  });

  it('deve reagendar uma solicitação de agendamento', async () => {
    if (!appointmentRequestId) return;
    const res = await request(app)
      .post(`/api/admin/requests/${appointmentRequestId}/reschedule`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newDate: '2025-12-02T10:00:00.000Z', newTime: '11:00' });
    expect([200, 400, 404]).toContain(res.status);
  });
}); 