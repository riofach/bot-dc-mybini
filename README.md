# MyBini Discord Bot

MyBini adalah Discord AI Chatbot yang ramah dan helpful. Bot ini menggunakan Gemini dan Groq sebagai AI backend dengan sistem fallback otomatis.

## ✨ Features

- **AI Chat**: Mention `@MyBini` untuk chat dengan AI
- **Friendly Personality**: Respons ramah, helpful, dan natural
- **Dual AI Backend**: Gemini (primary) + Groq (fallback)
- **Auto Fallback**: Otomatis switch ke backup API jika primary error
- **Multi API Keys**: Support multiple API keys dengan rotasi otomatis
- **Conversation Memory**: Mengingat 10 pesan terakhir per channel
- **Gold Price**: Harga emas harian dari harga-emas.org
- **News Broadcast**: Berita terpopuler Indonesia 3x sehari

## 📡 Broadcast Features

| Feature | Schedule | Channel |
|---------|----------|---------|
| 💰 Harga Emas | 07:00 WIB | `GOLD_CHANNEL_ID` |
| 📰 Berita Terpopuler | 07:00, 12:00, 18:00 WIB | `NEWS_CHANNEL_ID` |

### Sumber Berita
- CNN Indonesia
- Tempo
- Antara
- Republika
- Tribun News

## 🚀 Setup

### 1. Clone Repository

```bash
git clone https://github.com/riofach/bot-dc-mybini.git
cd Bot-Discord-MyBini
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy `.env.example` ke `.env`:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required
DISCORD_BOT_TOKEN=your_discord_bot_token
GEMINI_API_KEY=key1,key2,key3
GROQ_API_KEY=key1,key2
OWNER_ID=your_discord_user_id

# Optional - Broadcast Channels
GOLD_CHANNEL_ID=your_gold_channel_id
NEWS_CHANNEL_ID=your_news_channel_id

# Testing (set to 'true' for testing news every 30 seconds)
# NEWS_TEST_MODE=true
```

### 4. Get API Keys

| Service | Link |
|---------|------|
| Discord Bot Token | [Discord Developer Portal](https://discord.com/developers/applications) |
| Gemini API Key | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| Groq API Key | [Groq Console](https://console.groq.com/keys) |
| Owner ID | Enable Developer Mode → Klik kanan profile → Copy User ID |
| Channel ID | Klik kanan channel → Copy Channel ID |

### 5. Run Bot

Development:
```bash
npm run dev
```

Production:
```bash
npm start
```

## 💬 Usage

### Chat dengan Bot

Mention bot di channel manapun:

```
@MyBini halo!
@MyBini apa itu JavaScript?
@MyBini bantuin aku dong
```

### Commands

| Command | Access | Description |
|---------|--------|-------------|
| `/mybini emas` | Everyone | Lihat harga emas hari ini |
| `/mybini ping` | Everyone | Check bot latency |
| `/mybini status` | Owner | Info bot: uptime, API, memory |
| `/mybini switch <api>` | Owner | Manual switch API (gemini/groq) |
| `/mybini clear` | Owner | Clear memory channel ini |

## 🧪 Testing News Broadcast

Untuk test news broadcast setiap 30 detik:

1. Set di `.env`:
   ```env
   NEWS_CHANNEL_ID=your_channel_id
   NEWS_TEST_MODE=true
   ```

2. Jalankan bot:
   ```bash
   npm run dev
   ```

3. Bot akan kirim 1 berita setiap 30 detik ke channel tersebut

4. Setelah test selesai, hapus atau set `NEWS_TEST_MODE=false`

## 🚂 Deployment (Railway)

1. Push ke GitHub repository
2. Connect di [Railway](https://railway.app)
3. Add environment variables:
   - `DISCORD_BOT_TOKEN`
   - `GEMINI_API_KEY`
   - `GROQ_API_KEY`
   - `OWNER_ID`
   - `GOLD_CHANNEL_ID` (optional)
   - `NEWS_CHANNEL_ID` (optional)
4. Deploy!

Bot akan auto-start dengan Procfile.

## 🛠 Tech Stack

- Node.js 20.x LTS
- discord.js v14
- @google/generative-ai (Gemini)
- groq-sdk (Groq/Llama 3.3 70B)
- node-cron (Scheduler)
- rss-parser (News RSS)
- axios & cheerio (Web scraping)

## 📊 Free Tier Limits

| Service | Limit |
|---------|-------|
| Gemini | 15 req/min, 1500 req/day |
| Groq | 30 req/min, 6000 req/day |
| Railway | 500 hours/month |
| RSS Feeds | Unlimited |

## 📁 Project Structure

```
Bot-Discord-MyBini/
├── src/
│   ├── index.js              # Entry point
│   ├── config/
│   │   └── config.js         # Environment config
│   ├── handlers/
│   │   ├── messageHandler.js # Handle mentions
│   │   └── commandHandler.js # Handle slash commands
│   ├── services/
│   │   ├── aiService.js      # AI orchestration
│   │   ├── geminiService.js  # Gemini API
│   │   ├── groqService.js    # Groq API
│   │   ├── memoryService.js  # Conversation memory
│   │   ├── goldService.js    # Gold price fetcher
│   │   ├── newsService.js    # News RSS fetcher
│   │   └── schedulerService.js # Cron jobs
│   └── utils/
│       ├── personality.js    # Bot personality
│       └── logger.js         # Logging
├── .env.example
├── package.json
├── Procfile
└── README.md
```

## 📄 License

MIT

## 👤 Author

Created by **NasiSomay**

Instagram: [@rrdtyaa_](https://www.instagram.com/rrdtyaa_/)
