# 🚀 TP Odontologia Backend - Produção

## 📋 **Sistema de Notificações Implementado**

### **✅ Funcionalidades Ativas:**

#### **1. Notificações Automáticas**
- ✅ Confirmação de consultas
- ✅ Lembretes 24h antes
- ✅ Cancelamentos
- ✅ Reagendamentos
- ✅ Notificações gerais

#### **2. Interface de Usuário**
- ✅ Badge de notificações no cabeçalho
- ✅ Dropdown com lista de notificações
- ✅ Página completa de gerenciamento
- ✅ Marcar como lida individualmente
- ✅ Marcar todas como lidas
- ✅ Filtros (Todas, Não lidas, Lidas)

#### **3. Integração Completa**
- ✅ Notificações criadas automaticamente
- ✅ Email opcional (configurável)
- ✅ Banco de dados PostgreSQL
- ✅ API REST completa

---

## 🔧 **Configuração para Produção**

### **1. Variáveis de Ambiente (.env)**

```env
# Database
DATABASE_URL="postgresql://user:password@host:port/database"

# JWT
JWT_SECRET="sua-chave-secreta-muito-segura"
JWT_REFRESH_SECRET="sua-chave-refresh-secreta"

# Email (Opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-app
SMTP_FROM=seu-email@gmail.com
EMAIL_ENABLED=true

# Servidor
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://seu-frontend.com
```

### **2. Comandos de Deploy**

```bash
# Instalar dependências
npm install

# Gerar Prisma Client
npm run prisma:generate

# Executar migrations
npm run migrate

# Build para produção
npm run build

# Iniciar servidor
npm start
```

### **3. Cron Job para Notificações**

Configure um cron job para processar notificações agendadas:

```bash
# A cada 5 minutos
*/5 * * * * curl -X POST https://seu-backend.com/notifications/process-scheduled

# Ou usando o script
*/5 * * * * cd /path/to/backend && npm run notifications:process
```

---

## 📊 **Endpoints da API**

### **Notificações**
- `GET /notifications/my` - Minhas notificações
- `GET /notifications/unread-count` - Contagem não lidas
- `PUT /notifications/:id/read` - Marcar como lida
- `PUT /notifications/mark-all-read` - Marcar todas como lidas
- `POST /notifications/process-scheduled` - Processar agendadas

### **Autenticação**
- `POST /auth-patient/login` - Login paciente
- `POST /auth-patient/register` - Registro paciente
- `POST /auth/login` - Login admin
- `GET /auth-patient/me` - Dados do usuário

### **Consultas**
- `POST /patients/appointment-requests` - Solicitar consulta
- `GET /patients/appointment-requests` - Minhas consultas
- `GET /admin/appointments` - Listar consultas (admin)

---

## 🔒 **Segurança**

### **1. Autenticação**
- ✅ JWT com refresh tokens
- ✅ Middleware de autenticação
- ✅ Verificação de email
- ✅ Senhas criptografadas

### **2. CORS**
- ✅ Configurado para produção
- ✅ Origins permitidas configuráveis
- ✅ Headers seguros

### **3. Rate Limiting**
- ✅ Proteção contra spam
- ✅ Limites configuráveis

---

## 📈 **Monitoramento**

### **1. Logs**
- ✅ Logs de erro estruturados
- ✅ Logs de autenticação
- ✅ Logs de notificações

### **2. Métricas**
- ✅ Contagem de notificações
- ✅ Status de envio de emails
- ✅ Performance da API

---

## 🚨 **Troubleshooting**

### **Problemas Comuns:**

#### **1. Notificações não aparecem**
- Verificar se o usuário está autenticado
- Verificar se há notificações no banco
- Verificar logs do servidor

#### **2. Email não envia**
- Verificar configurações SMTP
- Verificar se EMAIL_ENABLED=true
- Verificar logs de email

#### **3. Cron job não funciona**
- Verificar permissões do script
- Verificar logs do cron
- Testar endpoint manualmente

---

## 📞 **Suporte**

Para suporte técnico:
- Email: suporte@tpodontologia.com
- Documentação: /docs
- Logs: /logs

---

**🎉 Sistema pronto para produção!** 