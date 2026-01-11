/**
 * Configuration Module
 * Centralize all environment variables and constants
 */

import 'dotenv/config';

// Validate required environment variables
const requiredEnvVars = [
  'DISCORD_BOT_TOKEN',
  'GEMINI_API_KEY',
  'GROQ_API_KEY',
  'OWNER_ID',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`[CONFIG] Missing: ${envVar}`);
    process.exit(1);
  }
}

/**
 * Parse comma-separated API keys into array
 */
function parseApiKeys(envValue) {
  return envValue
    .split(',')
    .map(key => key.trim())
    .filter(key => key.length > 0);
}

// Parse API keys
const geminiApiKeys = parseApiKeys(process.env.GEMINI_API_KEY);
const groqApiKeys = parseApiKeys(process.env.GROQ_API_KEY);

console.log(`[CONFIG] Gemini: ${geminiApiKeys.length} key(s) | Groq: ${groqApiKeys.length} key(s)`);

export const config = {
  discord: {
    token: process.env.DISCORD_BOT_TOKEN,
  },

  gemini: {
    apiKeys: geminiApiKeys,
    model: 'gemini-1.5-flash',
  },

  groq: {
    apiKeys: groqApiKeys,
    model: 'llama-3.3-70b-versatile', // Upgraded: lebih pintar dari 8b
  },

  ownerId: process.env.OWNER_ID,

  memory: {
    maxMessages: 10,
    cleanupInterval: 30 * 60 * 1000, // 30 minutes
    inactivityThreshold: 60 * 60 * 1000, // 1 hour
  },

  api: {
    timeout: 15000, // 15 seconds
    maxRetries: 1,
  },
};

export default config;
