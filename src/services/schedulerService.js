/**
 * Scheduler Service
 * Handle scheduled tasks like daily gold price broadcast
 */

import cron from 'node-cron';
import { config } from '../config/config.js';
import { getGoldPriceEmbed } from './goldService.js';
import { log } from '../utils/logger.js';

let scheduledTasks = [];
let discordClient = null;

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
  
  if (!channelId) {
    log.info('SCHEDULER', 'Gold broadcast skipped: No channel configured');
    return;
  }

  if (!discordClient) {
    log.error('SCHEDULER', 'Discord client not initialized');
    return;
  }

  try {
    const { valid, channel, error } = await validateChannel(discordClient, channelId);
    
    if (!valid) {
      log.error('SCHEDULER', `Invalid channel ${channelId}: ${error}`);
      return;
    }

    const embed = await getGoldPriceEmbed();
    
    await channel.send({
      content: '🌅 **Selamat Pagi!** Berikut update harga emas hari ini:',
      embeds: [embed],
    });

    log.info('SCHEDULER', `Gold price sent to #${channel.name}`);
  } catch (error) {
    log.error('SCHEDULER', `Failed to send gold price: ${error.message}`);
  }
}

/**
 * Start all scheduled tasks
 */
export function startScheduler(client) {
  discordClient = client;

  // Check if gold channel is configured
  if (!config.gold.channelId) {
    log.info('SCHEDULER', 'Gold broadcast disabled: GOLD_CHANNEL_ID not set');
    return [];
  }

  // Validate channel on startup
  validateChannel(client, config.gold.channelId).then(({ valid, channel, error }) => {
    if (valid) {
      log.info('SCHEDULER', `Gold broadcast channel: #${channel.name} (${config.gold.channelId})`);
    } else {
      log.error('SCHEDULER', `Invalid GOLD_CHANNEL_ID: ${error}`);
    }
  });

  // Schedule daily gold price at 7 AM Jakarta time
  const goldPriceTask = cron.schedule(config.gold.broadcastTime, () => {
    log.info('SCHEDULER', 'Running 7 AM gold price broadcast...');
    sendGoldPrice();
  }, {
    timezone: config.gold.timezone,
    scheduled: true,
  });

  scheduledTasks.push(goldPriceTask);
  log.info('SCHEDULER', 'Daily gold price scheduled for 07:00 WIB');

  return scheduledTasks;
}

/**
 * Stop all scheduled tasks
 */
export function stopScheduler() {
  scheduledTasks.forEach(task => task.stop());
  scheduledTasks = [];
  discordClient = null;
  log.info('SCHEDULER', 'All scheduled tasks stopped');
}

/**
 * Manually trigger gold price broadcast (for testing)
 */
export async function triggerGoldBroadcast() {
  await sendGoldPrice();
}

export default {
  startScheduler,
  stopScheduler,
  triggerGoldBroadcast,
};
