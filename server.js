import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// CORS headers for potential cross-origin access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Proxy route for FPL API
app.get('/api/*', async (req, res) => {
  const apiPath = req.params[0];
  const query = new URLSearchParams(req.query as Record<string, string>).toString();
  const url = `https://fantasy.premierleague.com/api/${apiPath}${query ? '?' + query : ''}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`FPL API responded with HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error(`Proxy Error for path ${apiPath}:`, error.message);
    res.status(500).json({
      error: `Failed to load data from FPL API (${apiPath}).`,
      details: error.message
    });
  }
});

// Serve Vite build output in production
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback for frontend client routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Express proxy server running at http://localhost:${PORT}`);
});
