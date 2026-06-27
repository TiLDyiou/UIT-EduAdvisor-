const http = require('http');

const data = JSON.stringify({
  student_code: "12345678",
  password: "password",
  captcha_state_id: "test",
  captcha_answer: "test",
  privacy_accepted: true,
  tos_accepted: true
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/onboarding/start',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
});

req.write(data);
req.end();
