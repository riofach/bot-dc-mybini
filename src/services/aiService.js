/**
 * AI Service
 * Orchestrates between Gemini and Groq with fallback logic
 */

import { generateWithGemini } from './geminiService.js';
import { generateWithGroq } from './groqService.js';
import { getErrorResponse } from '../utils/personality.js';
import { config } from '../config/config.js';
import { log } from '../utils/logger.js';

// State
let currentProvider = 'gemini'; // 'gemini' | 'groq'
let stats = {
  gemini: { success: 0, errors: 0 },
  groq: { success: 0, errors: 0 },
  fallbacks: 0,
};
let lastError = null;

/**
 * Get current provider
 */
export function getCurrentProvider() {
  return currentProvider;
}

/**
 * Switch provider manually
 */
export function switchProvider(provider) {
  if (provider !== 'gemini' && provider !== 'groq') {
    throw new Error('Invalid provider. Use "gemini" or "groq".');
  }
  const previous = currentProvider;
  currentProvider = provider;
  log.ai(`Provider switched: ${previous} -> ${provider}`);
  return { previous, current: currentProvider };
}

/**
 * Get API stats
 */
export function getStats() {
  return { ...stats, currentProvider, lastError };
}

/**
 * Reset stats
 */
export function resetStats() {
  stats = {
    gemini: { success: 0, errors: 0 },
    groq: { success: 0, errors: 0 },
    fallbacks: 0,
  };
  lastError = null;
}

/**
 * Try to generate with a specific provider
 */
async function tryGenerate(provider, messages, systemPrompt, retryCount = 0) {
  const generate = provider === 'gemini' ? generateWithGemini : generateWithGroq;

  try {
    const response = await generate(messages, systemPrompt);
    stats[provider].success++;
    return { success: true, response };
  } catch (error) {
    stats[provider].errors++;
    lastError = {
      provider,
      error: error.message,
      timestamp: new Date().toISOString(),
    };

    // Retry once if we haven't retried yet
    if (retryCount < config.api.maxRetries) {
      log.warn('AI', `${provider} failed, retrying... (attempt ${retryCount + 1})`);
      return tryGenerate(provider, messages, systemPrompt, retryCount + 1);
    }

    return { success: false, error };
  }
}

/**
 * Generate response with fallback logic
 * @param {Array} messages - Array of { role: 'user'|'assistant', content: string }
 * @param {string} systemPrompt - System prompt for personality
 * @returns {Promise<string>} - Generated response text
 */
export async function generateResponse(messages, systemPrompt) {
  const primaryProvider = currentProvider;
  const fallbackProvider = currentProvider === 'gemini' ? 'groq' : 'gemini';

  // Try primary provider
  log.ai(`Trying primary provider: ${primaryProvider}`);
  let result = await tryGenerate(primaryProvider, messages, systemPrompt);

  if (result.success) {
    return result.response;
  }

  // Primary failed, try fallback
  log.warn('AI', `Primary provider (${primaryProvider}) failed, falling back to ${fallbackProvider}`);
  stats.fallbacks++;

  result = await tryGenerate(fallbackProvider, messages, systemPrompt);

  if (result.success) {
    return result.response;
  }

  // Both failed, return in-character error
  log.error('AI', 'Both providers failed, returning error response');
  return getErrorResponse();
}

export default {
  generateResponse,
  getCurrentProvider,
  switchProvider,
  getStats,
  resetStats,
};
