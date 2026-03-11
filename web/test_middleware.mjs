import http from 'http';

http.get('http://localhost:2800/nc_api_version/index.html', (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let rawData = '';
  res.on('data', (chunk) => { rawData += chunk; });
  res.on('end', () => {
    console.log(`BODY: ${rawData.substring(0, 200)}...`);
  });
}).on('error', (e) => {
  console.error(`Got error: ${e.message}`);
});
