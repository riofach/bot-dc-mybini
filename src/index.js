/**
 * MyBini Discord Bot
 * Main Entry Point
 */

import { Client, GatewayIntentBits, Events } from 'discord.js';
import { config } from './config/config.js';
import { handleMessage } from './handlers/messageHandler.js';
import { registerCommands, handleCommand } from './handlers/commandHandler.js';
import { startCleanupInterval } from './services/memoryService.js';
import { log } from './utils/logger.js';

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Bot ready event
client.once(Events.ClientReady, async (c) => {
  log.info('DISCORD', `Logged in as ${c.user.tag}`);
  log.info('DISCORD', `Bot is in ${c.guilds.cache.size} server(s)`);

  // Register slash commands
  await registerCommands(client);

  // Start memory cleanup interval
  startCleanupInterval();

  // Set bot status
  client.user.setActivity('for @MyBini mentions', { type: 3 }); // Type 3 = Watching
});

// Message event
client.on(Events.MessageCreate, async (message) => {
  await handleMessage(message, client);
});

// Interaction event (slash commands)
client.on(Events.InteractionCreate, async (interaction) => {
  await handleCommand(interaction);
});

// Error handling
client.on(Events.Error, (error) => {
  log.error('DISCORD', `Client error: ${error.message}`, error);
});

process.on('unhandledRejection', (error) => {
  log.error('PROCESS', `Unhandled rejection: ${error.message}`, error);
});

process.on('uncaughtException', (error) => {
  log.error('PROCESS', `Uncaught exception: ${error.message}`, error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  log.info('PROCESS', 'Received SIGINT, shutting down...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log.info('PROCESS', 'Received SIGTERM, shutting down...');
  client.destroy();
  process.exit(0);
});

// Login to Discord
log.info('DISCORD', 'Starting MyBini Discord Bot...');
client.login(config.discord.token);
