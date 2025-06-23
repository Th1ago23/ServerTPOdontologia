async function testLogin() {
  try {
    console.log('Testando login do admin...');
    
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'tati.dent11@gmail.com',
        password: 'T4T1An3Th1ag0'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Erro no login:', errorData);
      console.error('Status:', response.status);
      return;
    }
    
    const data = await response.json();
    console.log('Login bem-sucedido!');
    console.log('Response:', data);
    
    // Testar o endpoint /me
    const token = data.accessToken;
    console.log('Token:', token);
    
    const meResponse = await fetch('http://localhost:3001/api/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!meResponse.ok) {
      const errorData = await meResponse.json();
      console.error('Erro no /me:', errorData);
      return;
    }
    
    const meData = await meResponse.json();
    console.log('Me endpoint response:', meData);
    
  } catch (error: any) {
    console.error('Erro no login:', error.message);
  }
}

testLogin(); 