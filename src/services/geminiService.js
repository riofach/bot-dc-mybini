/**
 * Gemini Service
 * Wrapper for Google Generative AI SDK with API key rotation
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/config.js';
import { log } from '../utils/logger.js';

// Track current API key index
let currentKeyIndex = 0;

/**
 * Get current API key
 */
export function getCurrentKeyIndex() {
  return currentKeyIndex;
}

/**
 * Get total number of API keys
 */
export function getTotalKeys() {
  return config.gemini.apiKeys.length;
}

/**
 * Rotate to next API key
 */
export function rotateKey() {
  const previousIndex = currentKeyIndex;
  currentKeyIndex = (currentKeyIndex + 1) % config.gemini.apiKeys.length;
  log.info('GEMINI', `Key rotated: ${previousIndex + 1} -> ${currentKeyIndex + 1}`);
  return currentKeyIndex;
}

/**
 * Create a new Gemini client with specific API key
 */
function createClient(apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ 
    model: config.gemini.model,
    generationConfig: {
      maxOutputTokens: 500,
      temperature: 0.85,
    },
  });
}

/**
 * Build conversation for Gemini
 * Gemini expects alternating user/model messages
 */
function buildConversation(messages, systemPrompt) {
  // Prepend system prompt as first user message for context
  const conversation = [];
  
  // Add system context as part of first message
  let systemAdded = false;
  
  for (const msg of messages) {
    if (!systemAdded && msg.role === 'user') {
      // Inject system prompt with first user message
      conversation.push({
        role: 'user',
        parts: [{ text: `[Instruksi: ${systemPrompt}]\n\nUser: ${msg.content}` }],
      });
      systemAdded = true;
    } else {
      conversation.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
  }
  
  // If no messages yet, just use system prompt
  if (conversation.length === 0) {
    conversation.push({
      role: 'user',
      parts: [{ text: systemPrompt }],
    });
  }
  
  return conversation;
}

/**
 * Try to generate with a specific API key
 */
async function tryWithKey(keyIndex, messages, systemPrompt) {
  const apiKey = config.gemini.apiKeys[keyIndex];
  const client = createClient(apiKey);
  const contents = buildConversation(messages, systemPrompt);

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.api.timeout);

  try {
    // Use generateContent directly for simpler approach
    const lastMessage = contents[contents.length - 1];
    
    // Build full prompt with context
    let fullPrompt = systemPrompt + '\n\n';
    for (const msg of messages) {
      const role = msg.role === 'user' ? 'User' : 'MyBini';
      fullPrompt += `${role}: ${msg.content}\n`;
    }
    fullPrompt += 'MyBini:';

    const result = await client.generateContent(fullPrompt);

    clearTimeout(timeoutId);

    const response = result.response;
    const text = response.text();

    log.ai(`Gemini response received (${text.length} chars)`);
    return { success: true, text };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      log.error('GEMINI', 'Timeout');
      return { success: false, error: new Error('TIMEOUT'), shouldRotate: true };
    }

    const isRateLimitOrInvalid = 
      error.message.includes('429') || 
      error.message.includes('rate limit') ||
      error.message.includes('API_KEY_INVALID') ||
      error.message.includes('quota') ||
      error.message.includes('400');

    log.error('GEMINI', `Key ${keyIndex + 1} failed`);
    return { success: false, error, shouldRotate: isRateLimitOrInvalid };
  }
}

/**
 * Generate response with Gemini (with key rotation)
 */
export async function generateWithGemini(messages, systemPrompt) {
  const totalKeys = config.gemini.apiKeys.length;
  let triedKeys = 0;

  while (triedKeys < totalKeys) {
    const result = await tryWithKey(currentKeyIndex, messages, systemPrompt);

    if (result.success) {
      return result.text;
    }

    if (result.shouldRotate && triedKeys < totalKeys - 1) {
      rotateKey();
      triedKeys++;
      continue;
    }

    throw result.error;
  }

  throw new Error('All Gemini API keys exhausted');
}

export default { generateWithGemini, getCurrentKeyIndex, getTotalKeys, rotateKey };
