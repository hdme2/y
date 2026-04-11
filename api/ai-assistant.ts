function getConfig() {
  const apiKey = process.env.VITE_API_KEY || process.env.GEMINI_API_KEY;
  const baseUrl = process.env.VITE_BASE_URL || 'https://api.minimaxi.com/v1';
  
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
    const modelName = process.env.GEMINI_MODEL || 'MiniMax-M2.7';

    const messages = [
      {
        role: 'system',
        content: '你是香港香水批發中間商的專業 AI 決策助手。請根據市場趨勢、庫存、利潤等提供專業的採購與銷售建議。使用繁體中文，語氣專業且具備商業洞察力。'
      },
      {
        role: 'user',
        content: message
      }
    ];

    const requestBody = {
      model: modelName,
      messages: messages,
      temperature: 0.7,
      max_tokens: 2048,
    };

    const apiUrl = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody)
    };

    const response = await fetch(apiUrl, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      return res.status(500).json({ error: `API Error ${response.status}`, detail: errorText });
    }

    const result = await response.json();
    
    if (result.choices && result.choices[0]?.message?.content) {
      return res.status(200).json({ text: result.choices[0].message.content });
    }
    
    return res.status(500).json({ error: 'Invalid API response', details: result });

  } catch (error: any) {
    console.error('AI Assistant error:', error);
    return res.status(500).json({ error: error.message });
  }
}
