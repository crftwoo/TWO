const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const JSON_FILE_PATH = path.join(__dirname, '..', 'assets', 'ofertas.json');
const PROJECT_DIR = path.join(__dirname, '..');

// Helper to calculate days diff
const isOlderThan5Days = (dateStr) => {
    const d = new Date(dateStr);
    const diffTime = Math.abs(new Date() - d);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) > 5;
};

const server = http.createServer((req, res) => {
    // Enable CORS to receive requests from the local Comparador
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
    }

    if (req.method === 'POST' && req.url === '/adicionar') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const newProduct = JSON.parse(body);
                
                // 1. Read existing offers
                let ofertas = [];
                if (fs.existsSync(JSON_FILE_PATH)) {
                    const rawData = fs.readFileSync(JSON_FILE_PATH);
                    ofertas = JSON.parse(rawData);
                }

                // 2. Clean up expired offers (older than 5 days) BEFORE adding new one
                ofertas = ofertas.filter(o => !isOlderThan5Days(o.data_insercao));

                // 3. Duplicate Prevention (Title + Price)
                const isDuplicate = ofertas.find(o => 
                    o.title === newProduct.title && o.spot === newProduct.spot
                );

                if (isDuplicate) {
                    res.writeHead(409, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ erro: "Produto já existe." }));
                }

                // Append Timestamp
                newProduct.data_insercao = new Date().toISOString();
                
                // Add to array and save
                ofertas.unshift(newProduct); // Add to the top
                fs.writeFileSync(JSON_FILE_PATH, JSON.stringify(ofertas, null, 2));

                // 4. Git Automation
                console.log(`[+] Added: ${newProduct.title}. Syncing to Website...`);
                const gitCmd = `git add assets/ofertas.json && git commit -m "sync(ofertas): adicionar ${newProduct.title.substring(0,20).replace(/[^a-zA-Z0-9 ]/g, '')}" && git push origin main`;
                
                exec(gitCmd, { cwd: PROJECT_DIR }, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Git push error: ${error.message}`);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ erro: "Falha ao enviar ao GitHub." }));
                    }
                    console.log(`[√] Successfully synced to Website.`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ sucesso: true }));
                });

            } catch (err) {
                console.error("Backend parsing logic failed:", err);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ erro: "Formato inválido." }));
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`🔧 Motor de Publicação ClimaFrio Ativado`);
    console.log(`========================================`);
    console.log(`-> Aguardando cliques na porta ${PORT}`);
    console.log(`-> Destino: github.com/crftwoo/TWO`);
    console.log(`-> DB: assets/ofertas.json`);
});
