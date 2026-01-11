/**
 * Groq Service
 * Wrapper for Groq SDK with API key rotation
 */

import Groq from 'groq-sdk';
import { config } from '../config/config.js';
import { log } from '../utils/logger.js';

// Track current API key index
let currentKeyIndex = 0;

/**
 * Get current API key index
 */
export function getCurrentKeyIndex() {
  return currentKeyIndex;
}

/**
 * Get total number of API keys
 */
export function getTotalKeys() {
  return config.groq.apiKeys.length;
}

/**
 * Rotate to next API key
 */
export function rotateKey() {
  const previousIndex = currentKeyIndex;
  currentKeyIndex = (currentKeyIndex + 1) % config.groq.apiKeys.length;
  log.info('GROQ', `Key rotated: ${previousIndex + 1} -> ${currentKeyIndex + 1}`);
  return currentKeyIndex;
}

/**
 * Create a new Groq client with specific API key
 */
function createClient(apiKey) {
  return new Groq({ apiKey });
}

/**
 * Format messages for Groq API (OpenAI-compatible format)
 */
function formatMessages(messages, systemPrompt) {
  const formatted = [
    {
      role: 'system',
      content: systemPrompt,
    },
  ];

  for (const msg of messages) {
    formatted.push({
      role: msg.role,
      content: msg.content,
    });
  }

  return formatted;
}

/**
 * Try to generate with a specific API key
 */
async function tryWithKey(keyIndex, messages, systemPrompt) {
  const apiKey = config.groq.apiKeys[keyIndex];
  const client = createClient(apiKey);
  const formattedMessages = formatMessages(messages, systemPrompt);

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.api.timeout);

  try {
    const completion = await client.chat.completions.create(
      {
        model: config.groq.model,
        messages: formattedMessages,
        max_tokens: 500,
        temperature: 0.85,
      },
      {
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    const text = completion.choices[0]?.message?.content || '';

    log.ai(`Groq response received (${text.length} chars)`);
    return { success: true, text };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      log.error('GROQ', 'Timeout');
      return { success: false, error: new Error('TIMEOUT'), shouldRotate: true };
    }

    const isRateLimitOrInvalid = 
      error.message.includes('429') || 
      error.message.includes('rate limit') ||
      error.message.includes('invalid_api_key') ||
      error.message.includes('401') ||
      error.message.includes('quota');

    log.error('GROQ', `Key ${keyIndex + 1} failed`);
    return { success: false, error, shouldRotate: isRateLimitOrInvalid };
  }
}

/**
 * Generate response with Groq (with key rotation)
 */
export async function generateWithGroq(messages, systemPrompt) {
  const totalKeys = config.groq.apiKeys.length;
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

  throw new Error('All Groq API keys exhausted');
}

export default { generateWithGroq, getCurrentKeyIndex, getTotalKeys, rotateKey };
