import * as xlsx from 'xlsx';

function getConfig() {
  const apiKey = process.env.VITE_API_KEY || process.env.GEMINI_API_KEY;
  const baseUrl = process.env.VITE_BASE_URL || process.env.GEMINI_BASE_URL;
  
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === '') {
    return null;
  }
  
  return { apiKey, baseUrl };
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const config = getConfig();
    if (!config) {
      return res.status(500).json({ error: 'VITE_API_KEY environment variable is required' });
    }

    const { file, mimeType, text } = req.body;
    
    let contentsParts: any[] = [];

    // Handle text input
    if (text) {
      contentsParts.push({
        text: `Here is the data from a quote document (text format):\n\n${text}`
      });
    } else if (file) {
      if (!mimeType) {
        return res.status(400).json({ error: 'No file or text provided' });
      }
      
      const fileBuffer = Buffer.from(file, 'base64');

      // Handle Excel files
      if (
        mimeType?.includes('spreadsheet') ||
        mimeType?.includes('excel') ||
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ) {
        try {
          const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
          const sheetNames = workbook.SheetNames;
          let allCsvData = '';
          
          // 讀取所有工作表
          for (const sheetName of sheetNames) {
            const csvData = xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]);
            allCsvData += `=== 工作表: ${sheetName} ===\n${csvData}\n\n`;
          }
          
          contentsParts.push({
            text: `Here is the data from an uploaded spreadsheet with ${sheetNames.length} worksheets (CSV format):\n\n${allCsvData.substring(0, 50000)}`
          });
        } catch (e) {
          mimeType = 'image/png';
        }
      }

      if (contentsParts.length === 0) {
        const base64Data = fileBuffer.toString('base64');
        contentsParts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType || 'image/png',
          },
        });
      }
    } else {
      return res.status(400).json({ error: 'No file or text provided' });
    }

    contentsParts.push({
      text: `You are an expert perfume wholesale data extractor. Extract all product rows from this quote document.
      Return a JSON array of objects. Each object MUST have these fields:
      - barcode (string, the EAN/UPC barcode, prioritize this)
      - name (string, product name)
      - size (string, e.g., '100ml')
      - spec (string, e.g., 'EDP', 'EDT')
      - price (number)
      - currency (string, e.g., 'USD', 'EUR', 'HKD', 'RMB')
      - moq (number)
      - status (string, e.g., '現貨', '期貨', '途中', '預訂')
      - batchNumber (string, if available)
      - supplier (string, infer from document header if available)
      - date (string, YYYY-MM-DD, infer from document if available)
      `,
    });

    const requestBody = {
      contents: [{ parts: contentsParts }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      }
    };

    // 构建 API URL
    let apiUrl = '';
    const useProxy = config.baseUrl && !config.baseUrl.includes('googleapis.com');
    
    if (useProxy) {
      const base = config.baseUrl.replace(/\/$/, '');
      apiUrl = `${base}/v1beta/models/gemini-2.0-flash:generateContent?key=${config.apiKey}`;
    } else {
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.apiKey}`;
    }

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    };

    console.log('API URL:', apiUrl.replace(config.apiKey, '***'));
    console.log('Use proxy:', useProxy);

    const response = await fetch(apiUrl, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      try {
        const errorJson = JSON.parse(errorText);
        const msg = errorJson.error?.message || errorJson.message || JSON.stringify(errorJson);
        return res.status(500).json({ error: msg });
      } catch {
        return res.status(500).json({ error: errorText });
      }
    }

    const result = await response.json();
    
    if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
      const parsedData = JSON.parse(result.candidates[0].content.parts[0].text);
      return res.status(200).json(parsedData);
    }
    
    return res.status(500).json({ error: 'Invalid API response', details: result });

  } catch (error: any) {
    console.error('Error parsing quote:', error);
    res.status(500).json({ error: error.message });
  }
}
