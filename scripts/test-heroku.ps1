# Nome do app de teste
$TEST_APP = "tpodontologia-backend-test"

Write-Host "🚀 Iniciando processo de teste no Heroku..." -ForegroundColor Cyan

# Verifica se o app já existe
try {
    $null = heroku apps:info -a $TEST_APP
    Write-Host "📦 App de teste já existe..." -ForegroundColor Yellow
} catch {
    Write-Host "📦 Criando novo app de teste..." -ForegroundColor Yellow
    heroku create $TEST_APP
}

# Configura variáveis de ambiente
Write-Host "⚙️ Configurando variáveis de ambiente..." -ForegroundColor Yellow
$timestamp = Get-Date -UFormat %s
heroku config:set NODE_ENV=test -a $TEST_APP
heroku config:set JWT_SECRET="test_jwt_secret_$timestamp" -a $TEST_APP
heroku config:set COOKIE_SECRET="test_cookie_secret_$timestamp" -a $TEST_APP

# Verifica se o banco de dados já existe
try {
    $null = heroku addons:info DATABASE_URL -a $TEST_APP
    Write-Host "🗄️ Banco de dados já existe..." -ForegroundColor Yellow
} catch {
    Write-Host "🗄️ Configurando banco de dados..." -ForegroundColor Yellow
    heroku addons:create heroku-postgresql:mini -a $TEST_APP
}

# Configura o remote do git se não existir
$remotes = git remote
if (-not ($remotes -match "test")) {
    Write-Host "🔧 Configurando remote do git..." -ForegroundColor Yellow
    git remote add test "https://git.heroku.com/$TEST_APP.git"
}

# Faz o deploy
Write-Host "🚀 Fazendo deploy para o ambiente de teste..." -ForegroundColor Yellow
git push test main

# Roda as migrations
Write-Host "🔄 Rodando migrations..." -ForegroundColor Yellow
heroku run npx prisma migrate deploy -a $TEST_APP

# Roda os testes
Write-Host "🧪 Rodando testes..." -ForegroundColor Yellow
heroku run npm test -a $TEST_APP

Write-Host "✅ Processo finalizado!" -ForegroundColor Green
Write-Host "Para ver os logs do app de teste:"
Write-Host "heroku logs --tail -a $TEST_APP" 