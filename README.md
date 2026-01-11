# MyBini Discord Bot

MyBini adalah Discord AI Chatbot dengan personality tsundere khas anime. Bot ini menggunakan Gemini dan Groq sebagai AI backend dengan sistem fallback otomatis.

## Features

- **AI Chat**: Mention `@MyBini` untuk chat dengan AI
- **Tsundere Personality**: Respons khas tsundere anime, panggil user sebagai "Master"
- **Dual AI Backend**: Gemini (primary) + Groq (fallback)
- **Auto Fallback**: Otomatis switch ke backup API jika primary error
- **Conversation Memory**: Mengingat 10 pesan terakhir per channel
- **Owner Commands**: Slash commands untuk owner

## Setup

### 1. Clone Repository

```bash
git clone <repo-url>
cd Bot-Discord-MyBini
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy `.env.example` ke `.env` dan isi dengan API keys:

```bash
cp .env.example .env
```

Edit `.env`:

```env
DISCORD_BOT_TOKEN=your_discord_bot_token
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
OWNER_ID=your_discord_user_id
```

### 4. Get API Keys

- **Discord Bot Token**: [Discord Developer Portal](https://discord.com/developers/applications)
- **Gemini API Key**: [Google AI Studio](https://aistudio.google.com/app/apikey)
- **Groq API Key**: [Groq Console](https://console.groq.com/keys)
- **Owner ID**: Enable Developer Mode di Discord, klik kanan profile, Copy User ID

### 5. Run Bot

Development:
```bash
npm run dev
```

Production:
```bash
npm start
```

## Usage

### Chat dengan Bot

Mention bot di channel manapun:

```
@MyBini halo!
@MyBini apa itu JavaScript?
@MyBini bantuin aku dong
```

### Owner Commands

| Command | Description |
|---------|-------------|
| `/mybini status` | Info bot: uptime, API aktif, memory stats |
| `/mybini switch <api>` | Manual switch API (gemini/groq) |
| `/mybini clear` | Clear memory channel ini |
| `/mybini ping` | Check bot latency |

## Deployment (Railway)

1. Push ke GitHub repository
2. Connect di [Railway](https://railway.app)
3. Add environment variables
4. Deploy!

Bot akan auto-start dengan Procfile.

## Tech Stack

- Node.js 20.x LTS
- discord.js v14
- @google/generative-ai (Gemini)
- groq-sdk (Groq/Llama)
- dotenv

## Free Tier Limits

| Service | Limit |
|---------|-------|
| Gemini | 15 req/min, 1500 req/day |
| Groq | 30 req/min, 20k tokens/min |
| Railway | 500 hours/month |

## License

MIT
