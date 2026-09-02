import express, { Request, Response } from 'express';
import { executeSearch } from './geminiService.ts';

export const apiRouter = express.Router();

apiRouter.use(express.json({ limit: '15mb' }));

apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'OmniSearch AI Multi-LLM Aggregator',
    geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

apiRouter.post('/validate-openrouter', async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      res.status(400).json({ valid: false, message: 'API key is required' });
      return;
    }

    const cleanKey = apiKey.trim();
    const testRes = await fetch('https://openrouter.ai/api/v1/auth/key', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cleanKey}`,
      },
    });

    if (testRes.ok) {
      const info = await testRes.json();
      res.json({
        valid: true,
        message: 'OpenRouter API key is verified and operational',
        data: info?.data || info,
      });
    } else {
      const errText = await testRes.text().catch(() => '');
      res.status(testRes.status).json({
        valid: false,
        message: errText || `OpenRouter returned status ${testRes.status}`,
      });
    }
  } catch (error: any) {
    res.status(500).json({
      valid: false,
      message: error?.message || 'Error communicating with OpenRouter',
    });
  }
});

apiRouter.post('/search', async (req: Request, res: Response) => {
  try {
    const { query, mode = 'fast', models = [], fileContent, fileName, fileType, language = 'ar' } = req.body;

    if (!query && !fileContent) {
      res.status(400).json({ error: 'Query or fileContent is required' });
      return;
    }

    const result = await executeSearch({
      query: query || (fileName ? `Analysis of file: ${fileName}` : 'Analyze provided content'),
      mode,
      models,
      fileContent,
      fileName,
      fileType,
      language: language === 'en' ? 'en' : 'ar',
    });

    res.json(result);
  } catch (error: any) {
    console.error('Search execution failed:', error);
    res.status(500).json({
      error: error.message || 'Failed to process search request',
      details: String(error),
    });
  }
});
