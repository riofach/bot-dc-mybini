/**
 * News Service
 * Fetch trending news from Indonesian RSS feeds
 */

import Parser from 'rss-parser';
import { log } from '../utils/logger.js';

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  },
});

/**
 * RSS Feed sources for Indonesian news (verified working)
 */
const RSS_SOURCES = [
  {
    name: 'CNN Indonesia',
    url: 'https://www.cnnindonesia.com/nasional/rss',
    icon: '🔴',
  },
  {
    name: 'CNN Teknologi',
    url: 'https://www.cnnindonesia.com/teknologi/rss',
    icon: '🔵',
  },
  {
    name: 'Tempo',
    url: 'https://rss.tempo.co/nasional',
    icon: '🟢',
  },
  {
    name: 'Antara',
    url: 'https://www.antaranews.com/rss/terkini',
    icon: '🟡',
  },
  {
    name: 'Republika',
    url: 'https://www.republika.co.id/rss',
    icon: '🟠',
  },
  {
    name: 'Tribun',
    url: 'https://www.tribunnews.com/rss',
    icon: '🔶',
  },
];

/**
 * Fetch news from a single RSS source
 */
async function fetchFromSource(source) {
  try {
    const feed = await parser.parseURL(source.url);
    
    return feed.items.slice(0, 5).map(item => ({
      title: item.title?.trim() || 'No title',
      link: item.link || '',
      source: source.name,
      icon: source.icon,
      pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
    }));
  } catch (error) {
    // Silent fail for individual sources
    return [];
  }
}

/**
 * Fetch news from all sources and aggregate
 */
async function fetchAllNews() {
  const allNews = [];
  
  // Fetch from all sources in parallel
  const results = await Promise.allSettled(
    RSS_SOURCES.map(source => fetchFromSource(source))
  );
  
  // Collect successful results
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      allNews.push(...result.value);
    }
  }
  
  // Sort by publication date (newest first)
  allNews.sort((a, b) => b.pubDate - a.pubDate);
  
  // Remove duplicates based on title similarity
  const uniqueNews = [];
  const seenTitles = new Set();
  
  for (const news of allNews) {
    // Normalize title for comparison
    const normalizedTitle = news.title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .substring(0, 40);
    
    if (!seenTitles.has(normalizedTitle)) {
      seenTitles.add(normalizedTitle);
      uniqueNews.push(news);
    }
  }
  
  return uniqueNews;
}

/**
 * Get top news (limited count)
 */
export async function getTopNews(count = 7) {
  const allNews = await fetchAllNews();
  return allNews.slice(0, count);
}

/**
 * Format relative time
 */
function formatRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Baru saja';
  if (diffMins < 60) return `${diffMins} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  return `${diffDays} hari lalu`;
}

/**
 * Truncate title if too long
 */
function truncateTitle(title, maxLength = 80) {
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength - 3) + '...';
}

/**
 * Get news as Discord embed
 */
export async function getNewsEmbed() {
  const news = await getTopNews(7);
  
  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
  
  const dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (news.length === 0) {
    return {
      color: 0xFF6B6B,
      title: '📰 Berita Terpopuler',
      description: '⚠️ Gagal mengambil berita. Coba lagi nanti.',
      timestamp: now.toISOString(),
    };
  }

  // Format news list with clickable links
  const newsLines = news.map((item, index) => {
    const num = index + 1;
    const title = truncateTitle(item.title);
    const time = formatRelativeTime(item.pubDate);
    return `**${num}.** [${title}](${item.link})\n   └ ${item.icon} ${item.source} • ${time}`;
  }).join('\n\n');

  const embed = {
    color: 0x1DA1F2,
    title: '📰 Berita Terpopuler Hari Ini',
    description: `📅 ${dateStr}\n🕐 Update: ${timeStr} WIB\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n${newsLines}`,
    footer: {
      text: 'Sumber: CNN Indonesia, Tempo, Antara, Republika, Tribun',
    },
    timestamp: now.toISOString(),
  };

  return embed;
}

/**
 * Get single news item (for testing)
 */
export async function getSingleNews() {
  const news = await getTopNews(1);
  
  if (news.length === 0) {
    return null;
  }

  const item = news[0];
  const now = new Date();
  
  return {
    color: 0xFFA500,
    title: '🧪 Test News Broadcast',
    description: `**${item.title}**\n\n${item.icon} ${item.source} • ${formatRelativeTime(item.pubDate)}\n\n🔗 [Baca selengkapnya](${item.link})`,
    footer: {
      text: '⚠️ Ini adalah test broadcast - akan dihapus',
    },
    timestamp: now.toISOString(),
  };
}

export default {
  getTopNews,
  getNewsEmbed,
  getSingleNews,
};
