/**
 * Command Handler
 * Register and handle slash commands
 */

import { REST, Routes, SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { config } from '../config/config.js';
import { getCurrentProvider, switchProvider, getStats } from '../services/aiService.js';
import { getCurrentKeyIndex as getGeminiKeyIndex, getTotalKeys as getGeminiTotalKeys } from '../services/geminiService.js';
import { getCurrentKeyIndex as getGroqKeyIndex, getTotalKeys as getGroqTotalKeys } from '../services/groqService.js';
import { clearChannel, getMemoryStats } from '../services/memoryService.js';
import { getGoldPriceEmbed } from '../services/goldService.js';
import { generateImageUrl } from '../services/imageService.js';
import { getPlayerInfo, buildPlayerEmbed } from '../services/robloxService.js';
import { getUnauthorizedResponse } from '../utils/personality.js';
import { log } from '../utils/logger.js';
import axios from 'axios';

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
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('imagine')
        .setDescription('Generate gambar dengan AI 🎨')
        .addStringOption(option =>
          option
            .setName('prompt')
            .setDescription('Deskripsi gambar yang ingin dibuat')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('width')
            .setDescription('Lebar gambar (256-1920, default: 1024)')
            .setRequired(false)
            .setMinValue(256)
            .setMaxValue(1920)
        )
        .addIntegerOption(option =>
          option
            .setName('height')
            .setDescription('Tinggi gambar (256-1920, default: 1024)')
            .setRequired(false)
            .setMinValue(256)
            .setMaxValue(1920)
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('roblox')
        .setDescription('Roblox related commands 🎮')
        .addSubcommand(subcommand =>
          subcommand
            .setName('player')
            .setDescription('Lookup profil pemain Roblox 👤')
            .addStringOption(option =>
              option
                .setName('username')
                .setDescription('Username Roblox yang ingin dicari')
                .setRequired(true)
            )
        )
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

  // Check if it's a subcommand group (like /mybini roblox player)
  let subcommandGroup = null;
  let subcommand = null;
  
  try {
    subcommandGroup = interaction.options.getSubcommandGroup(false);
    subcommand = interaction.options.getSubcommand();
  } catch {
    subcommand = interaction.options.getSubcommand();
  }

  const fullCommand = subcommandGroup 
    ? `${subcommandGroup} ${subcommand}` 
    : subcommand;
    
  log.discord(`Command: /mybini ${fullCommand} by ${interaction.user.tag}`);

  // Commands that don't require owner
  const publicCommands = ['ping', 'emas', 'imagine', 'roblox player'];

  // Check if user is owner for restricted commands
  if (!publicCommands.includes(fullCommand) && interaction.user.id !== config.ownerId) {
    await interaction.reply({
      content: getUnauthorizedResponse(),
      ephemeral: true,
    });
    return;
  }

  try {
    // Handle subcommand groups first
    if (subcommandGroup === 'roblox') {
      switch (subcommand) {
        case 'player':
          await handleRobloxPlayer(interaction);
          return;
        default:
          await interaction.reply({
            content: 'Unknown roblox subcommand!',
            ephemeral: true,
          });
          return;
      }
    }

    // Handle regular subcommands
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
      case 'imagine':
        await handleImagine(interaction);
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
  await interaction.deferReply();

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

/**
 * Handle /mybini imagine - Image Generation Command (PUBLIC)
 */
async function handleImagine(interaction) {
  const prompt = interaction.options.getString('prompt');
  const width = interaction.options.getInteger('width') || 1024;
  const height = interaction.options.getInteger('height') || 1024;

  await interaction.deferReply();

  try {
    // Generate image URL
    const imageData = generateImageUrl(prompt, { width, height });
    
    log.discord(`Generating image: ${width}x${height} - "${prompt.substring(0, 30)}..."`);

    // Fetch the image
    const response = await axios.get(imageData.url, {
      responseType: 'arraybuffer',
      timeout: 60000, // 60 second timeout for image generation
    });

    // Create attachment from buffer
    const attachment = new AttachmentBuilder(Buffer.from(response.data), {
      name: 'generated-image.png',
    });

    // Create embed
    const embed = {
      color: 0x9B59B6,
      title: '🎨 AI Generated Image',
      description: `**Prompt:** ${prompt.length > 200 ? prompt.substring(0, 200) + '...' : prompt}`,
      image: {
        url: 'attachment://generated-image.png',
      },
      fields: [
        {
          name: '📐 Size',
          value: `${imageData.width}x${imageData.height}`,
          inline: true,
        },
        {
          name: '🎲 Seed',
          value: `${imageData.seed}`,
          inline: true,
        },
      ],
      footer: {
        text: `Requested by ${interaction.user.tag} • Powered by Pollinations.ai`,
      },
      timestamp: new Date().toISOString(),
    };

    await interaction.editReply({
      embeds: [embed],
      files: [attachment],
    });

    log.discord(`Image generated for ${interaction.user.tag}`);
  } catch (error) {
    console.error('[IMAGE] Error:', error);
    
    let errorMessage = '⚠️ Maaf, gagal generate gambar. ';
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      errorMessage += 'Request timeout - coba lagi atau gunakan ukuran lebih kecil.';
    } else if (error.response?.status === 400) {
      errorMessage += 'Prompt tidak valid atau mengandung konten yang dilarang.';
    } else {
      errorMessage += 'Coba lagi nanti ya!';
    }

    await interaction.editReply({
      content: errorMessage,
    });
  }
}

/**
 * Handle /mybini roblox player - Roblox Player Lookup (PUBLIC)
 */
async function handleRobloxPlayer(interaction) {
  const username = interaction.options.getString('username');

  await interaction.deferReply();

  try {
    log.discord(`Roblox lookup: ${username}`);

    // Get player info from Roblox API
    const playerData = await getPlayerInfo(username);
    
    // Build embed
    const embed = buildPlayerEmbed(playerData);

    await interaction.editReply({
      embeds: [embed],
    });

    if (playerData.success) {
      log.discord(`Roblox player found: ${playerData.username} (ID: ${playerData.userId})`);
    } else {
      log.discord(`Roblox player not found: ${username}`);
    }
  } catch (error) {
    console.error('[ROBLOX] Error:', error);
    
    await interaction.editReply({
      content: '⚠️ Maaf, gagal mengambil data dari Roblox. Coba lagi nanti ya!',
    });
  }
}

export default { registerCommands, handleCommand };
