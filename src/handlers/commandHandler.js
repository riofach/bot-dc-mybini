/**
 * Command Handler
 * Register and handle slash commands
 */

import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { config } from '../config/config.js';
import { getCurrentProvider, switchProvider, getStats } from '../services/aiService.js';
import { getCurrentKeyIndex as getGeminiKeyIndex, getTotalKeys as getGeminiTotalKeys } from '../services/geminiService.js';
import { getCurrentKeyIndex as getGroqKeyIndex, getTotalKeys as getGroqTotalKeys } from '../services/groqService.js';
import { clearChannel, getMemoryStats } from '../services/memoryService.js';
import { getGoldPriceEmbed } from '../services/goldService.js';
import { getUnauthorizedResponse } from '../utils/personality.js';
import { log } from '../utils/logger.js';

// Track bot start time for uptime
const startTime = Date.now();

/**
 * Define slash commands
 */
const commands = [
  new SlashCommandBuilder()
    .setName('mybini')
    .setDescription('MyBini bot commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Show bot status, uptime, and API info (Owner only)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('switch')
        .setDescription('Switch primary AI provider (Owner only)')
        .addStringOption(option =>
          option
            .setName('api')
            .setDescription('API provider to switch to')
            .setRequired(true)
            .addChoices(
              { name: 'Gemini', value: 'gemini' },
              { name: 'Groq', value: 'groq' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('clear')
        .setDescription('Clear conversation memory for this channel (Owner only)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('ping')
        .setDescription('Check bot latency')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('emas')
        .setDescription('Lihat harga emas hari ini 📊')
    ),
];

/**
 * Register slash commands
 */
export async function registerCommands(client) {
  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  try {
    log.discord('Registering slash commands...');

    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands.map(cmd => cmd.toJSON()) }
    );

    log.discord('Slash commands registered!');
  } catch (error) {
    console.error('[COMMANDS] Failed to register:', error);
  }
}

/**
 * Format uptime to human readable
 */
function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
  if (seconds % 60 > 0) parts.push(`${seconds % 60}s`);

  return parts.join(' ') || '0s';
}

/**
 * Handle slash command interaction
 */
export async function handleCommand(interaction) {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  
  if (commandName !== 'mybini') return;

  const subcommand = interaction.options.getSubcommand();
  log.discord(`Command: /mybini ${subcommand} by ${interaction.user.tag}`);

  // Commands that don't require owner
  const publicCommands = ['ping', 'emas'];

  // Check if user is owner for restricted commands
  if (!publicCommands.includes(subcommand) && interaction.user.id !== config.ownerId) {
    await interaction.reply({
      content: getUnauthorizedResponse(),
      ephemeral: true,
    });
    return;
  }

  try {
    switch (subcommand) {
      case 'status':
        await handleStatus(interaction);
        break;
      case 'switch':
        await handleSwitch(interaction);
        break;
      case 'clear':
        await handleClear(interaction);
        break;
      case 'ping':
        await handlePing(interaction);
        break;
      case 'emas':
        await handleGold(interaction);
        break;
      default:
        await interaction.reply({
          content: 'Unknown subcommand!',
          ephemeral: true,
        });
    }
  } catch (error) {
    console.error('[COMMANDS] Error:', error);
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: 'Maaf, ada error. Coba lagi ya!',
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: 'Maaf, ada error. Coba lagi ya!',
        ephemeral: true,
      });
    }
  }
}

/**
 * Handle /mybini status
 */
async function handleStatus(interaction) {
  const uptime = formatUptime(Date.now() - startTime);
  const stats = getStats();
  const memoryStats = getMemoryStats();

  const geminiKeyInfo = `Key ${getGeminiKeyIndex() + 1}/${getGeminiTotalKeys()}`;
  const groqKeyInfo = `Key ${getGroqKeyIndex() + 1}/${getGroqTotalKeys()}`;

  const statusEmbed = {
    color: 0xFF69B4,
    title: '📊 MyBini Status',
    fields: [
      {
        name: '⏱️ Uptime',
        value: uptime,
        inline: true,
      },
      {
        name: '🤖 Current AI',
        value: stats.currentProvider.toUpperCase(),
        inline: true,
      },
      {
        name: '💾 Memory',
        value: `${memoryStats.channels} ch | ${memoryStats.totalMessages} msg`,
        inline: true,
      },
      {
        name: '🔑 Gemini',
        value: `${geminiKeyInfo}\n✅${stats.gemini.success} ❌${stats.gemini.errors}`,
        inline: true,
      },
      {
        name: '🔑 Groq',
        value: `${groqKeyInfo}\n✅${stats.groq.success} ❌${stats.groq.errors}`,
        inline: true,
      },
      {
        name: '🔄 Fallbacks',
        value: `${stats.fallbacks}`,
        inline: true,
      },
    ],
    footer: {
      text: stats.lastError ? `Last Error: ${stats.lastError.provider}` : 'No errors',
    },
    timestamp: new Date().toISOString(),
  };

  await interaction.reply({ embeds: [statusEmbed], ephemeral: true });
  log.discord('Status command executed');
}

/**
 * Handle /mybini switch
 */
async function handleSwitch(interaction) {
  const api = interaction.options.getString('api');

  try {
    const result = switchProvider(api);
    await interaction.reply({
      content: `✅ Switched: **${result.previous.toUpperCase()}** → **${result.current.toUpperCase()}**\n\nSekarang pakai ${api.toUpperCase()} ya!`,
      ephemeral: true,
    });
    log.discord(`API switched to ${api}`);
  } catch (error) {
    await interaction.reply({
      content: `❌ Error: ${error.message}`,
      ephemeral: true,
    });
  }
}

/**
 * Handle /mybini clear
 */
async function handleClear(interaction) {
  const channelId = interaction.channelId;
  const cleared = clearChannel(channelId);

  if (cleared) {
    await interaction.reply({
      content: '🧹 Memory cleared! Percakapan di channel ini sudah dihapus.',
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: '📭 Gak ada memory di channel ini yang perlu dihapus.',
      ephemeral: true,
    });
  }
  log.discord(`Memory cleared: ${channelId}`);
}

/**
 * Handle /mybini ping
 */
async function handlePing(interaction) {
  const sent = await interaction.reply({
    content: '🏓 Pinging...',
    ephemeral: true,
    fetchReply: true,
  });

  const latency = sent.createdTimestamp - interaction.createdTimestamp;
  const wsLatency = interaction.client.ws.ping;

  await interaction.editReply({
    content: `🏓 **Pong!**\n\n📡 Latency: **${latency}ms**\n💓 WebSocket: **${wsLatency}ms**`,
  });
  log.discord(`Ping: ${latency}ms`);
}

/**
 * Handle /mybini emas - Gold Price Command (PUBLIC)
 */
async function handleGold(interaction) {
  await interaction.deferReply(); // Gold fetch might take a while

  try {
    const embed = await getGoldPriceEmbed();
    
    await interaction.editReply({
      content: '💰 **Harga Emas Terkini**',
      embeds: [embed],
    });

    log.discord('Gold price command executed');
  } catch (error) {
    console.error('[GOLD] Error:', error);
    await interaction.editReply({
      content: '⚠️ Maaf, gagal mengambil data harga emas. Coba lagi nanti ya!',
    });
  }
}

export default { registerCommands, handleCommand };
