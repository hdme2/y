# 香水批發追蹤君 - 微信版

這是一個專為香港香水批發中間商設計的工具，專注於微信生態圈的報單生成、比價、批號解讀與 AI 決策。

## 核心功能
1. **智能報單上傳**：支援拖拽 PDF/圖片，使用 Gemini API 自動解析條碼、品名、價格、批號。
2. **產品主檔與高清圖**：自動透過 Barcode API 抓取高清產品圖，支援 Supabase 雲端儲存。
3. **一鍵生成報單**：支援生成 PDF、微信圖片版、微信文字版，帶有公司 LOGO 與自動計算的階層利潤。
4. **AI 決策助手**：內建 Gemini API，提供市場分析與採購建議。
5. **客戶管理 (CRM)**：追蹤未回覆客戶，一鍵生成跟進話術。

## 技術棧
- **前端**：React 19 + Vite + Tailwind CSS + shadcn/ui (自訂元件)
- **後端**：Express (API Routes)
- **AI 引擎**：Google Gemini 3.1 Pro Preview
- **資料庫**：Supabase (PostgreSQL)
- **圖片生成**：html-to-image
- **Email**：Resend API

## 環境變數設定 (.env)
請在根目錄建立 `.env` 檔案並填入以下資訊：

\`\`\`env
# Gemini API (必須) - 用於解析報單與 AI 助手
GEMINI_API_KEY=your_gemini_api_key

# Supabase (可選) - 用於產品主檔與 LOGO 儲存
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Resend (可選) - 用於發送 Email 報單
RESEND_API_KEY=your_resend_api_key

# Barcode API (可選) - 用於抓取高清產品圖 (如 Go-UPC 或 Barcode Lookup)
BARCODE_API_KEY=your_barcode_api_key
\`\`\`

## 部署到 Vercel
1. 將專案推送到 GitHub。
2. 在 Vercel 匯入專案。
3. 框架預設選擇 `Vite`。
4. 在 Environment Variables 填入上述 `.env` 的所有金鑰。
5. 點擊 Deploy 即可。

*註：由於此專案包含 Express 後端，若要完全 Serverless 部署至 Vercel，建議將 `server.ts` 中的 API 路由遷移至 Next.js App Router 的 Route Handlers (`app/api/...`)，或使用 Vercel 的 `api/` 目錄結構。目前結構最適合部署在支援 Node.js 的容器環境 (如 Cloud Run, Render, Railway)。*
