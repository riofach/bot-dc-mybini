/**
 * Roblox Service
 * Fetches player info, avatar, and status from Roblox Public API
 * 100% FREE - No API Key Required!
 */

import axios from 'axios';
import { log } from '../utils/logger.js';

// Roblox API Endpoints
const API = {
  users: 'https://users.roblox.com',
  thumbnails: 'https://thumbnails.roblox.com',
  friends: 'https://friends.roblox.com',
  presence: 'https://presence.roblox.com',
  games: 'https://games.roblox.com',
};

// Presence type mapping
const PRESENCE_TYPES = {
  0: { status: 'Offline', emoji: '⚫', color: 0x808080 },
  1: { status: 'Online', emoji: '🟢', color: 0x00FF00 },
  2: { status: 'In-Game', emoji: '🎮', color: 0x00BFFF },
  3: { status: 'In-Studio', emoji: '🔧', color: 0xFFA500 },
};

/**
 * Get User ID from username
 */
async function getUserIdFromUsername(username) {
  try {
    const response = await axios.post(`${API.users}/v1/usernames/users`, {
      usernames: [username],
      excludeBannedUsers: false,
    });

    if (response.data.data && response.data.data.length > 0) {
      return response.data.data[0];
    }
    return null;
  } catch (error) {
    log.error('ROBLOX', `Failed to get user ID for ${username}: ${error.message}`);
    throw error;
  }
}

/**
 * Get User Profile by ID
 */
async function getUserProfile(userId) {
  try {
    const response = await axios.get(`${API.users}/v1/users/${userId}`);
    return response.data;
  } catch (error) {
    log.error('ROBLOX', `Failed to get profile for ${userId}: ${error.message}`);
    throw error;
  }
}

/**
 * Get Friends/Followers/Following Count
 */
async function getSocialCounts(userId) {
  try {
    const [friends, followers, following] = await Promise.all([
      axios.get(`${API.friends}/v1/users/${userId}/friends/count`),
      axios.get(`${API.friends}/v1/users/${userId}/followers/count`),
      axios.get(`${API.friends}/v1/users/${userId}/followings/count`),
    ]);

    return {
      friends: friends.data.count || 0,
      followers: followers.data.count || 0,
      following: following.data.count || 0,
    };
  } catch (error) {
    log.error('ROBLOX', `Failed to get social counts for ${userId}: ${error.message}`);
    return { friends: 0, followers: 0, following: 0 };
  }
}

/**
 * Get Avatar Thumbnail URL
 */
async function getAvatarUrl(userId, type = 'full') {
  try {
    const size = type === 'headshot' ? '420x420' : '420x420';
    const endpoint = type === 'headshot' ? 'avatar-headshot' : 'avatar';
    
    const response = await axios.get(`${API.thumbnails}/v1/users/${endpoint}`, {
      params: {
        userIds: userId,
        size: size,
        format: 'Png',
        isCircular: false,
      },
    });

    if (response.data.data && response.data.data.length > 0) {
      return response.data.data[0].imageUrl;
    }
    return null;
  } catch (error) {
    log.error('ROBLOX', `Failed to get avatar for ${userId}: ${error.message}`);
    return null;
  }
}

/**
 * Get User Presence (Online Status)
 */
async function getUserPresence(userId) {
  try {
    const response = await axios.post(`${API.presence}/v1/presence/users`, {
      userIds: [userId],
    });

    if (response.data.userPresences && response.data.userPresences.length > 0) {
      const presence = response.data.userPresences[0];
      const presenceInfo = PRESENCE_TYPES[presence.userPresenceType] || PRESENCE_TYPES[0];
      
      return {
        ...presenceInfo,
        lastLocation: presence.lastLocation || null,
        placeId: presence.placeId || null,
        gameId: presence.gameId || null,
        universeId: presence.universeId || null,
        lastOnline: presence.lastOnline || null,
      };
    }
    return PRESENCE_TYPES[0];
  } catch (error) {
    log.error('ROBLOX', `Failed to get presence for ${userId}: ${error.message}`);
    return PRESENCE_TYPES[0];
  }
}

/**
 * Get Game Name from Universe ID
 */
async function getGameName(universeId) {
  try {
    const response = await axios.get(`${API.games}/v1/games`, {
      params: { universeIds: universeId },
    });

    if (response.data.data && response.data.data.length > 0) {
      return response.data.data[0].name;
    }
    return null;
  } catch (error) {
    log.error('ROBLOX', `Failed to get game name for ${universeId}: ${error.message}`);
    return null;
  }
}

/**
 * Format number with K/M/B suffix
 */
function formatNumber(num) {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Calculate account age
 */
function getAccountAge(createdDate) {
  const created = new Date(createdDate);
  const now = new Date();
  const diffTime = Math.abs(now - created);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays >= 365) {
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    if (months > 0) {
      return `${years} tahun ${months} bulan`;
    }
    return `${years} tahun`;
  }
  if (diffDays >= 30) {
    const months = Math.floor(diffDays / 30);
    return `${months} bulan`;
  }
  return `${diffDays} hari`;
}

/**
 * Format date to Indonesian format
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Get Complete Player Info - Main Function
 * Returns all player data in one call
 */
export async function getPlayerInfo(username) {
  log.info('ROBLOX', `Looking up player: ${username}`);
  
  // Step 1: Get User ID from username
  const userData = await getUserIdFromUsername(username);
  
  if (!userData) {
    return {
      success: false,
      error: 'User tidak ditemukan!',
    };
  }

  const userId = userData.id;
  const displayName = userData.displayName;
  const actualUsername = userData.name;

  // Step 2: Fetch all data in parallel for speed
  const [profile, social, avatarUrl, presence] = await Promise.all([
    getUserProfile(userId),
    getSocialCounts(userId),
    getAvatarUrl(userId, 'full'),
    getUserPresence(userId),
  ]);

  // Step 3: Get game name if user is in-game
  let gameName = null;
  if (presence.universeId) {
    gameName = await getGameName(presence.universeId);
  }

  // Step 4: Build the result
  const result = {
    success: true,
    userId,
    username: actualUsername,
    displayName,
    description: profile.description || 'Tidak ada bio',
    created: profile.created,
    createdFormatted: formatDate(profile.created),
    accountAge: getAccountAge(profile.created),
    isBanned: profile.isBanned || false,
    hasVerifiedBadge: profile.hasVerifiedBadge || false,
    social: {
      friends: social.friends,
      friendsFormatted: formatNumber(social.friends),
      followers: social.followers,
      followersFormatted: formatNumber(social.followers),
      following: social.following,
      followingFormatted: formatNumber(social.following),
    },
    avatar: avatarUrl,
    presence: {
      ...presence,
      gameName,
    },
  };

  log.info('ROBLOX', `Found player: ${actualUsername} (ID: ${userId})`);
  return result;
}

/**
 * Build Discord Embed for Player Info
 */
export function buildPlayerEmbed(playerData) {
  if (!playerData.success) {
    return {
      color: 0xFF0000,
      title: '❌ User Tidak Ditemukan',
      description: playerData.error || 'Username tidak valid atau tidak ditemukan di Roblox.',
    };
  }

  const { presence } = playerData;
  
  // Build status text
  let statusText = `${presence.emoji} ${presence.status}`;
  if (presence.gameName) {
    statusText += `\n🎮 Playing: **${presence.gameName}**`;
  } else if (presence.lastLocation && presence.status !== 'Offline') {
    statusText += `\n📍 ${presence.lastLocation}`;
  }

  // Build description
  let description = '';
  if (playerData.hasVerifiedBadge) {
    description += '✅ **Verified**\n\n';
  }
  if (playerData.isBanned) {
    description += '🚫 **BANNED**\n\n';
  }
  description += `> ${playerData.description.length > 200 ? playerData.description.substring(0, 200) + '...' : playerData.description}`;

  const embed = {
    color: presence.color,
    author: {
      name: playerData.displayName !== playerData.username 
        ? `${playerData.displayName} (@${playerData.username})`
        : `@${playerData.username}`,
      url: `https://www.roblox.com/users/${playerData.userId}/profile`,
      icon_url: playerData.avatar,
    },
    title: '👤 Roblox Player Profile',
    description,
    thumbnail: {
      url: playerData.avatar,
    },
    fields: [
      {
        name: '🆔 User ID',
        value: `\`${playerData.userId}\``,
        inline: true,
      },
      {
        name: '📅 Joined',
        value: `${playerData.createdFormatted}\n(${playerData.accountAge})`,
        inline: true,
      },
      {
        name: '📊 Status',
        value: statusText,
        inline: true,
      },
      {
        name: '👥 Friends',
        value: playerData.social.friendsFormatted,
        inline: true,
      },
      {
        name: '👤 Followers',
        value: playerData.social.followersFormatted,
        inline: true,
      },
      {
        name: '➡️ Following',
        value: playerData.social.followingFormatted,
        inline: true,
      },
    ],
    image: {
      url: playerData.avatar,
    },
    footer: {
      text: 'Roblox Player Lookup • Data from Roblox API',
      icon_url: 'https://images.rbxcdn.com/23421382939a9f4ae8bbe60dbe2a3e7e.ico',
    },
    timestamp: new Date().toISOString(),
  };

  return embed;
}

export default {
  getPlayerInfo,
  buildPlayerEmbed,
};
