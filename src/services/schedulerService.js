/**
 * Scheduler Service
 * Handle scheduled tasks: gold price & news broadcast
 */

import cron from 'node-cron';
import { config } from '../config/config.js';
import { getGoldPriceEmbed } from './goldService.js';
import { getNewsEmbed, getSingleNews } from './newsService.js';
import { log } from '../utils/logger.js';

let scheduledTasks = [];
let discordClient = null;
let testInterval = null;

/**
 * Get greeting based on Jakarta time
 */
function getGreeting() {
  const jakartaTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
  const hour = new Date(jakartaTime).getHours();
  
  if (hour >= 5 && hour < 11) {
    return { emoji: '🌅', text: 'Selamat Pagi' };
  } else if (hour >= 11 && hour < 15) {
    return { emoji: '☀️', text: 'Selamat Siang' };
  } else if (hour >= 15 && hour < 19) {
    return { emoji: '🌆', text: 'Selamat Sore' };
  } else {
    return { emoji: '🌙', text: 'Selamat Malam' };
  }
}

/**
 * Validate channel exists and bot has access
 */
async function validateChannel(client, channelId) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      return { valid: false, error: 'Channel not found' };
    }
    if (!channel.isTextBased()) {
      return { valid: false, error: 'Channel is not a text channel' };
    }
    return { valid: true, channel };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Send gold price to specified channel
 */
async function sendGoldPrice() {
  const channelId = config.gold.channelId;
  
  if (!channelId || !discordClient) return;

  try {
    const { valid, channel, error } = await validateChannel(discordClient, channelId);
    
    if (!valid) {
      log.error('GOLD', `Invalid channel: ${error}`);
      return;
    }

    const embed = await getGoldPriceEmbed();
    const { emoji, text } = getGreeting();
    
    await channel.send({
      content: `${emoji} **${text}!** Berikut update harga emas hari ini:`,
      embeds: [embed],
    });

    log.info('GOLD', `Sent to #${channel.name}`);
  } catch (error) {
    log.error('GOLD', `Failed: ${error.message}`);
  }
}

/**
 * Send news to specified channel
 */
async function sendNews() {
  const channelId = config.news.channelId;
  
  if (!channelId || !discordClient) return;

  try {
    const { valid, channel, error } = await validateChannel(discordClient, channelId);
    
    if (!valid) {
      log.error('NEWS', `Invalid channel: ${error}`);
      return;
    }

    const embed = await getNewsEmbed();
    const { emoji, text } = getGreeting();
    
    const greetingMessages = {
      'Selamat Pagi': 'Berikut berita terpopuler:',
      'Selamat Siang': 'Update berita terkini:',
      'Selamat Sore': 'Jangan lewatkan berita hari ini:',
      'Selamat Malam': 'Berita terkini untuk kamu:',
    };
    
    const greeting = `${emoji} **${text}!** ${greetingMessages[text] || 'Berikut berita terpopuler:'}`;

    await channel.send({
      content: greeting,
      embeds: [embed],
    });

    log.info('NEWS', `Sent to #${channel.name}`);
  } catch (error) {
    log.error('NEWS', `Failed: ${error.message}`);
  }
}

/**
 * Send single test news (for testing)
 */
async function sendTestNews() {
  const channelId = config.news.channelId;
  
  if (!channelId || !discordClient) return;

  try {
    const { valid, channel, error } = await validateChannel(discordClient, channelId);
    
    if (!valid) {
      log.error('NEWS-TEST', `Invalid channel: ${error}`);
      return;
    }

    const embed = await getSingleNews();
    
    if (!embed) {
      log.error('NEWS-TEST', 'No news available');
      return;
    }

    await channel.send({ embeds: [embed] });

    log.info('NEWS-TEST', `Test news sent to #${channel.name}`);
  } catch (error) {
    log.error('NEWS-TEST', `Failed: ${error.message}`);
  }
}

/**
 * Start all scheduled tasks
 */
export function startScheduler(client) {
  discordClient = client;

  // ============ GOLD PRICE SCHEDULER ============
  if (config.gold.channelId) {
    validateChannel(client, config.gold.channelId).then(({ valid, channel, error }) => {
      if (valid) {
        log.info('SCHEDULER', `Gold channel: #${channel.name}`);
      } else {
        log.error('SCHEDULER', `Invalid GOLD_CHANNEL_ID: ${error}`);
      }
    });

    const goldTask = cron.schedule(config.gold.broadcastTime, () => {
      log.info('SCHEDULER', 'Running gold price broadcast...');
      sendGoldPrice();
    }, {
      timezone: config.gold.timezone,
      scheduled: true,
    });

    scheduledTasks.push(goldTask);
    log.info('SCHEDULER', 'Gold: 07:00 WIB daily');
  } else {
    log.info('SCHEDULER', 'Gold broadcast disabled');
  }

  // ============ NEWS SCHEDULER ============
  if (config.news.channelId) {
    validateChannel(client, config.news.channelId).then(({ valid, channel, error }) => {
      if (valid) {
        log.info('SCHEDULER', `News channel: #${channel.name}`);
      } else {
        log.error('SCHEDULER', `Invalid NEWS_CHANNEL_ID: ${error}`);
      }
    });

    // Check if test mode is enabled
    if (config.news.testMode) {
      log.info('SCHEDULER', '⚠️ NEWS TEST MODE: Sending every 30 seconds');
      
      // Send first test immediately after 5 seconds
      setTimeout(() => {
        sendTestNews();
      }, 5000);

      // Then every 30 seconds
      testInterval = setInterval(() => {
        sendTestNews();
      }, 30000);
      
    } else {
      // Normal mode: 3x daily
      for (const time of config.news.broadcastTimes) {
        const newsTask = cron.schedule(time, () => {
          log.info('SCHEDULER', 'Running news broadcast...');
          sendNews();
        }, {
          timezone: config.news.timezone,
          scheduled: true,
        });

        scheduledTasks.push(newsTask);
      }
      log.info('SCHEDULER', 'News: 07:00, 12:00, 18:00 WIB daily');
    }
  } else {
    log.info('SCHEDULER', 'News broadcast disabled');
  }

  return scheduledTasks;
}

/**
 * Stop all scheduled tasks
 */
export function stopScheduler() {
  scheduledTasks.forEach(task => task.stop());
  scheduledTasks = [];
  
  if (testInterval) {
    clearInterval(testInterval);
    testInterval = null;
  }
  
  discordClient = null;
  log.info('SCHEDULER', 'All tasks stopped');
}

/**
 * Manually trigger broadcasts (for testing)
 */
export async function triggerGoldBroadcast() {
  await sendGoldPrice();
}

export async function triggerNewsBroadcast() {
  await sendNews();
}

export default {
  startScheduler,
  stopScheduler,
  triggerGoldBroadcast,
  triggerNewsBroadcast,
};
