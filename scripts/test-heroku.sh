#!/bin/bash

# Nome do app de teste
TEST_APP="tpodontologia-backend-test"

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "🚀 Iniciando processo de teste no Heroku..."

# Verifica se o app já existe
if ! heroku apps:info -a $TEST_APP &> /dev/null; then
    echo "📦 Criando novo app de teste..."
    heroku create $TEST_APP
else
    echo "📦 App de teste já existe..."
fi

# Configura variáveis de ambiente
echo "⚙️ Configurando variáveis de ambiente..."
heroku config:set NODE_ENV=test -a $TEST_APP
heroku config:set JWT_SECRET=test_jwt_secret_$(date +%s) -a $TEST_APP
heroku config:set COOKIE_SECRET=test_cookie_secret_$(date +%s) -a $TEST_APP

# Verifica se o banco de dados já existe
if ! heroku addons:info DATABASE_URL -a $TEST_APP &> /dev/null; then
    echo "🗄️ Configurando banco de dados..."
    heroku addons:create heroku-postgresql:mini -a $TEST_APP
else
    echo "🗄️ Banco de dados já existe..."
fi

# Configura o remote do git se não existir
if ! git remote | grep -q "test"; then
    echo "🔧 Configurando remote do git..."
    git remote add test https://git.heroku.com/$TEST_APP.git
fi

# Faz o deploy
echo "🚀 Fazendo deploy para o ambiente de teste..."
git push test main

# Roda as migrations
echo "🔄 Rodando migrations..."
heroku run npx prisma migrate deploy -a $TEST_APP

# Roda os testes
echo "🧪 Rodando testes..."
heroku run npm test -a $TEST_APP

echo -e "${GREEN}✅ Processo finalizado!${NC}"
echo "Para ver os logs do app de teste:"
echo "heroku logs --tail -a $TEST_APP" 