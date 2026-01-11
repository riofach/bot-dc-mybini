/**
 * Memory Service
 * Per-channel conversation memory with Map
 */

import { config } from '../config/config.js';
import { log } from '../utils/logger.js';

/**
 * Memory storage
 * Map<channelId, { messages: Array, lastActivity: Date }>
 */
const channelMemory = new Map();

let cleanupIntervalId = null;

/**
 * Add a message to channel memory
 * @param {string} channelId - Discord channel ID
 * @param {string} role - 'user' or 'assistant'
 * @param {string} content - Message content
 */
export function addMessage(channelId, role, content) {
  if (!channelMemory.has(channelId)) {
    channelMemory.set(channelId, {
      messages: [],
      lastActivity: new Date(),
    });
  }

  const channelData = channelMemory.get(channelId);
  channelData.messages.push({ role, content });
  channelData.lastActivity = new Date();

  // Enforce max messages (FIFO)
  if (channelData.messages.length > config.memory.maxMessages) {
    channelData.messages.shift();
  }

  log.debug('MEMORY', `Added message to channel ${channelId} (${channelData.messages.length} msgs)`);
}

/**
 * Get conversation history for a channel
 * @param {string} channelId - Discord channel ID
 * @returns {Array} - Array of { role, content }
 */
export function getHistory(channelId) {
  const channelData = channelMemory.get(channelId);
  if (!channelData) {
    return [];
  }
  return [...channelData.messages];
}

/**
 * Clear memory for a specific channel
 * @param {string} channelId - Discord channel ID
 * @returns {boolean} - Whether anything was cleared
 */
export function clearChannel(channelId) {
  const existed = channelMemory.has(channelId);
  channelMemory.delete(channelId);
  if (existed) {
    log.info('MEMORY', `Cleared memory for channel ${channelId}`);
  }
  return existed;
}

/**
 * Get memory stats
 */
export function getMemoryStats() {
  let totalMessages = 0;
  for (const [, data] of channelMemory) {
    totalMessages += data.messages.length;
  }
  return {
    channels: channelMemory.size,
    totalMessages,
  };
}

/**
 * Cleanup inactive channels
 * Removes channels that have been inactive for more than the threshold
 */
export function cleanupInactiveChannels() {
  const now = new Date();
  let cleaned = 0;

  for (const [channelId, data] of channelMemory) {
    const inactiveTime = now - data.lastActivity;
    if (inactiveTime > config.memory.inactivityThreshold) {
      channelMemory.delete(channelId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    log.info('MEMORY', `Cleaned up ${cleaned} inactive channel(s)`);
  }

  return cleaned;
}

/**
 * Start the cleanup interval
 */
export function startCleanupInterval() {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
  }

  cleanupIntervalId = setInterval(() => {
    cleanupInactiveChannels();
  }, config.memory.cleanupInterval);

  log.info('MEMORY', `Cleanup interval started (every ${config.memory.cleanupInterval / 1000 / 60} minutes)`);
}

/**
 * Stop the cleanup interval
 */
export function stopCleanupInterval() {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    log.info('MEMORY', 'Cleanup interval stopped');
  }
}

export default {
  addMessage,
  getHistory,
  clearChannel,
  getMemoryStats,
  cleanupInactiveChannels,
  startCleanupInterval,
  stopCleanupInterval,
};
