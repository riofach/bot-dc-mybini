/**
 * Scheduler Service
 * Handle scheduled tasks like daily gold price broadcast
 */

import cron from 'node-cron';
import { getGoldPriceEmbed } from './goldService.js';
import { log } from '../utils/logger.js';

// Channel ID for gold price broadcast
const GOLD_BROADCAST_CHANNEL = '146222493237628523';

let scheduledTasks = [];

/**
 * Send gold price to specified channel
 */
async function sendGoldPrice(client) {
  try {
    const channel = await client.channels.fetch(GOLD_BROADCAST_CHANNEL);
    
    if (!channel) {
      log.error('SCHEDULER', `Channel ${GOLD_BROADCAST_CHANNEL} not found`);
      return;
    }

    const embed = await getGoldPriceEmbed();
    
    await channel.send({
      content: '🌅 **Selamat Pagi!** Berikut update harga emas hari ini:',
      embeds: [embed],
    });

    log.info('SCHEDULER', 'Gold price broadcast sent successfully');
  } catch (error) {
    log.error('SCHEDULER', `Failed to send gold price: ${error.message}`);
  }
}

/**
 * Start all scheduled tasks
 */
export function startScheduler(client) {
  // Daily gold price at 7:00 AM WIB (00:00 UTC = 07:00 WIB)
  // WIB is UTC+7, so 7 AM WIB = 0 AM UTC
  const goldPriceTask = cron.schedule('0 0 * * *', () => {
    log.info('SCHEDULER', 'Running daily gold price broadcast...');
    sendGoldPrice(client);
  }, {
    timezone: 'Asia/Jakarta',
    scheduled: true,
  });

  // Actually schedule for 7 AM Jakarta time
  const goldPriceTask7AM = cron.schedule('0 7 * * *', () => {
    log.info('SCHEDULER', 'Running 7 AM gold price broadcast...');
    sendGoldPrice(client);
  }, {
    timezone: 'Asia/Jakarta',
    scheduled: true,
  });

  scheduledTasks.push(goldPriceTask7AM);

  log.info('SCHEDULER', 'Daily gold price scheduled for 07:00 WIB');

  return scheduledTasks;
}

/**
 * Stop all scheduled tasks
 */
export function stopScheduler() {
  scheduledTasks.forEach(task => task.stop());
  scheduledTasks = [];
  log.info('SCHEDULER', 'All scheduled tasks stopped');
}

/**
 * Manually trigger gold price broadcast
 */
export async function triggerGoldBroadcast(client) {
  await sendGoldPrice(client);
}

export default {
  startScheduler,
  stopScheduler,
  triggerGoldBroadcast,
};
