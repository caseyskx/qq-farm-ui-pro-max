import http.server
import socketserver
import os
import json
import urllib.parse
import calculator_engine

PORT = 2800

class ProxyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_dict = dict(urllib.parse.parse_qsl(parsed_url.query))

        if path.startswith('/api/'):
            self.handle_local_api(path, query_dict)
            return

        # Rewrite paths for specific HTML files
        if path == '/calculator':
            self.path = '/calculator.html'
        elif path == '/levels':
            self.path = '/levels.html'
        elif path == '/lands':
            self.path = '/lands.html'
        elif path == '/plants':
            self.path = '/plants.html'
        elif path == '/items':
            self.path = '/items.html'
            
        super().do_GET()

    def handle_local_api(self, path, params):
        self.send_response(200)
        self.send_header('Content-type', 'application/json; charset=utf-8')
        # CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.end_headers()

        response_data = {}
        if path == '/api/time_crops':
            response_data = calculator_engine.calculate_time_crops()
        elif path == '/api/lands_for_level':
            level = int(params.get('level', 1))
            response_data = calculator_engine.calculate_lands_for_level(level)
        elif path == '/api/calculator':
            response_data = calculator_engine.calculate_main(params)
        elif path in ['/api/level_exp_calc', '/api/level_exp_calc_save']:
            params['_path'] = path
            response_data = calculator_engine.calculate_exp_plan(params)
        else:
            response_data = {"error": f"Path {path} not implemented"}

        self.wfile.write(json.dumps(response_data, ensure_ascii=False).encode('utf-8'))

Handler = ProxyHTTPRequestHandler

if __name__ == '__main__':
    # 强制重启前先清理端口
    import socket
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Server perfectly running on http://127.0.0.1:{PORT}")
        httpd.serve_forever()
