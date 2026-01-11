/**
 * Message Handler
 * Handle @mention messages and trigger AI response
 */

import { generateResponse } from '../services/aiService.js';
import { addMessage, getHistory } from '../services/memoryService.js';
import { buildSystemPrompt, getErrorResponse } from '../utils/personality.js';
import { log } from '../utils/logger.js';

/**
 * Extract user message by removing bot mention
 */
function extractMessage(message, client) {
  let content = message.content;

  // Remove all mentions of the bot
  const botMention = `<@${client.user.id}>`;
  const botMentionNick = `<@!${client.user.id}>`;

  content = content.replace(new RegExp(botMention, 'g'), '').trim();
  content = content.replace(new RegExp(botMentionNick, 'g'), '').trim();

  return content;
}

/**
 * Handle incoming message
 */
export async function handleMessage(message, client) {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Check if bot is mentioned
  if (!message.mentions.has(client.user)) return;

  const channelId = message.channel.id;
  const userId = message.author.id;
  const userName = message.member?.displayName || message.author.username;

  // Extract the actual message content
  const userMessage = extractMessage(message, client);

  // Handle empty message
  if (!userMessage) {
    await message.reply("Ara ara~ kamu manggil Kakak tapi gak bilang apa-apa? Ada yang bisa Kakak bantu, Sayang~? 💕");
    return;
  }

  log.discord(`Message from ${userName} (${userId}) in channel ${channelId}: ${userMessage.substring(0, 50)}...`);

  try {
    // Show typing indicator
    await message.channel.sendTyping();

    // Add user message to memory
    addMessage(channelId, 'user', userMessage);

    // Get conversation history
    const history = getHistory(channelId);

    // Build system prompt with user name
    const systemPrompt = buildSystemPrompt(userName);

    // Generate AI response
    const response = await generateResponse(history, systemPrompt);

    // Add assistant response to memory
    addMessage(channelId, 'assistant', response);

    // Split response if too long (Discord limit: 2000 chars)
    if (response.length > 1900) {
      const chunks = splitMessage(response, 1900);
      for (let i = 0; i < chunks.length; i++) {
        if (i === 0) {
          await message.reply(chunks[i]);
        } else {
          await message.channel.send(chunks[i]);
        }
      }
    } else {
      await message.reply(response);
    }

    log.discord(`Replied to ${userName} (${response.length} chars)`);
  } catch (error) {
    log.error('MESSAGE', `Error handling message: ${error.message}`, error);

    try {
      await message.reply(getErrorResponse());
    } catch (replyError) {
      log.error('MESSAGE', `Failed to send error reply: ${replyError.message}`);
    }
  }
}

/**
 * Split long message into chunks
 */
function splitMessage(text, maxLength) {
  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find a good break point (newline, space, or just cut)
    let breakPoint = remaining.lastIndexOf('\n', maxLength);
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      breakPoint = remaining.lastIndexOf(' ', maxLength);
    }
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      breakPoint = maxLength;
    }

    chunks.push(remaining.substring(0, breakPoint));
    remaining = remaining.substring(breakPoint).trim();
  }

  return chunks;
}

export default { handleMessage };
