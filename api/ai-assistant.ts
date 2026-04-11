function getConfig() {
  const apiKey = process.env.VITE_API_KEY || process.env.GEMINI_API_KEY;
  const baseUrl = process.env.VITE_BASE_URL || process.env.GEMINI_BASE_URL;
  
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === '') {
    return null;
  }
  
  return { apiKey, baseUrl };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const config = getConfig();
    if (!config) {
      return res.status(500).json({ error: 'VITE_API_KEY environment variable is required' });
    }

    const { message } = req.body;
    const modelName = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

    const requestBody = {
      contents: [{ parts: [{ text: message }] }],
      systemInstruction: {
        parts: [{ text: '你是香港香水批發中間商的專業 AI 決策助手。請根據市場趨勢、庫存、利潤等提供專業的採購與銷售建議。使用繁體中文，語氣專業且具備商業洞察力。' }]
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      }
    };

    let apiUrl = '';
    
    if (config.baseUrl && !config.baseUrl.includes('googleapis.com')) {
      const base = config.baseUrl.replace(/\/$/, '');
      apiUrl = `${base}/v1beta/models/${modelName}:generateContent?key=${config.apiKey}`;
    } else {
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${config.apiKey}`;
    }

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    };

    const response = await fetch(apiUrl, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ error: `API Error ${response.status}`, detail: errorText });
    }

    const result = await response.json();
    
    if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
      return res.status(200).json({ text: result.candidates[0].content.parts[0].text });
    }
    
    return res.status(500).json({ error: 'Invalid response', details: result });

  } catch (error: any) {
    console.error('AI Assistant error:', error);
    return res.status(500).json({ error: error.message });
  }
}
