/**
 * Gold Price Service
 * Fetch gold prices from various sources
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { log } from '../utils/logger.js';

/**
 * Fetch Indonesian Gold Prices (Antam) from harga-emas.org
 */
async function fetchAntamPrices() {
  try {
    const response = await axios.get('https://harga-emas.org/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    
    // Parse Antam prices from the table
    const antamPrices = [];
    
    // Find the Antam gold price table
    $('table').each((i, table) => {
      const tableText = $(table).text().toLowerCase();
      if (tableText.includes('antam') || tableText.includes('gram')) {
        $(table).find('tr').each((j, row) => {
          const cols = $(row).find('td');
          if (cols.length >= 2) {
            const weight = $(cols[0]).text().trim();
            const price = $(cols[1]).text().trim();
            if (weight && price && price.includes('Rp')) {
              antamPrices.push({ weight, price });
            }
          }
        });
      }
    });

    // Get main gold price
    let mainPrice = null;
    const priceElement = $('div:contains("Harga Emas Hari Ini")').first();
    if (priceElement.length) {
      const priceText = priceElement.parent().text();
      const priceMatch = priceText.match(/Rp[\s]?[\d.,]+/);
      if (priceMatch) {
        mainPrice = priceMatch[0];
      }
    }

    // Alternative: find price from different selector
    if (!mainPrice) {
      $('strong, b, h2, h3').each((i, el) => {
        const text = $(el).text();
        if (text.includes('Rp') && text.match(/[\d.,]+/)) {
          mainPrice = text.trim();
          return false;
        }
      });
    }

    return {
      success: true,
      mainPrice,
      prices: antamPrices.slice(0, 8), // Limit to 8 items
      source: 'harga-emas.org',
    };
  } catch (error) {
    log.error('GOLD', `Antam fetch error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch International Gold Price from alternative source
 */
async function fetchInternationalPrice() {
  try {
    // Using exchangerate.host or similar free API
    const response = await axios.get('https://api.exchangerate.host/latest', {
      params: {
        base: 'XAU', // Gold
        symbols: 'USD,IDR',
      },
      timeout: 10000,
    });

    if (response.data && response.data.rates) {
      const usdPerOunce = 1 / response.data.rates.USD;
      const idrPerOunce = response.data.rates.IDR / response.data.rates.USD;
      
      // Convert to per gram (1 troy ounce = 31.1035 grams)
      const usdPerGram = usdPerOunce / 31.1035;
      const idrPerGram = idrPerOunce / 31.1035;

      return {
        success: true,
        usdPerGram: usdPerGram.toFixed(2),
        usdPerOunce: usdPerOunce.toFixed(2),
        idrPerGram: Math.round(idrPerGram).toLocaleString('id-ID'),
        idrPerOunce: Math.round(idrPerOunce).toLocaleString('id-ID'),
        source: 'exchangerate.host',
      };
    }

    throw new Error('Invalid response');
  } catch (error) {
    // Fallback: try gold-api or other source
    try {
      return await fetchGoldPriceFallback();
    } catch (fallbackError) {
      log.error('GOLD', `International fetch error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

/**
 * Fallback for international gold price
 */
async function fetchGoldPriceFallback() {
  try {
    // Scrape from goldprice.org or similar
    const response = await axios.get('https://www.goldprice.org/id/gold-price-indonesia.html', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    
    // Try to find gold price
    let usdPrice = null;
    let idrPrice = null;

    $('div, span').each((i, el) => {
      const text = $(el).text();
      if (text.includes('$') && text.match(/\$[\d.,]+/)) {
        const match = text.match(/\$([\d.,]+)/);
        if (match) usdPrice = match[1];
      }
    });

    return {
      success: true,
      usdPerOunce: usdPrice || 'N/A',
      source: 'goldprice.org',
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get current IDR exchange rate
 */
async function getExchangeRate() {
  try {
    const response = await axios.get('https://api.exchangerate.host/latest', {
      params: { base: 'USD', symbols: 'IDR' },
      timeout: 10000,
    });
    return response.data?.rates?.IDR || 15500; // Default fallback rate
  } catch {
    return 15500; // Fallback rate
  }
}

/**
 * Format number to Indonesian Rupiah
 */
function formatRupiah(number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(number);
}

/**
 * Get all gold prices and format as embed
 */
export async function getGoldPriceEmbed() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });

  // Fetch prices in parallel
  const [antamData, internationalData] = await Promise.all([
    fetchAntamPrices(),
    fetchInternationalPrice(),
  ]);

  const fields = [];

  // International Gold Price
  if (internationalData.success) {
    fields.push({
      name: '🌍 Harga Emas Internasional',
      value: [
        `💵 **USD/oz:** $${internationalData.usdPerOunce || 'N/A'}`,
        `💵 **USD/gram:** $${internationalData.usdPerGram || 'N/A'}`,
        `💰 **IDR/gram:** Rp ${internationalData.idrPerGram || 'N/A'}`,
      ].join('\n'),
      inline: false,
    });
  } else {
    fields.push({
      name: '🌍 Harga Emas Internasional',
      value: '⚠️ Data tidak tersedia saat ini',
      inline: false,
    });
  }

  // Antam Gold Prices
  if (antamData.success && antamData.prices.length > 0) {
    const antamList = antamData.prices
      .slice(0, 6)
      .map(p => `${p.weight}: **${p.price}**`)
      .join('\n');

    fields.push({
      name: '🇮🇩 Harga Emas Antam',
      value: antamList || 'Data tidak tersedia',
      inline: false,
    });
  } else if (antamData.mainPrice) {
    fields.push({
      name: '🇮🇩 Harga Emas Antam',
      value: `💰 **${antamData.mainPrice}** per gram`,
      inline: false,
    });
  } else {
    fields.push({
      name: '🇮🇩 Harga Emas Antam',
      value: '⚠️ Data tidak tersedia saat ini',
      inline: false,
    });
  }

  // Tips/Info
  fields.push({
    name: '💡 Info',
    value: '```Harga dapat berubah sewaktu-waktu.\nData diambil dari berbagai sumber.```',
    inline: false,
  });

  const embed = {
    color: 0xFFD700, // Gold color
    title: '📊 Harga Emas Hari Ini',
    description: `📅 **${dateStr}**\n🕐 Update: ${timeStr} WIB`,
    fields,
    footer: {
      text: `Sumber: ${antamData.source || 'Various'} | ${internationalData.source || ''}`,
    },
    timestamp: new Date().toISOString(),
  };

  return embed;
}

/**
 * Quick function to get gold prices as text (for AI response)
 */
export async function getGoldPriceText() {
  const embed = await getGoldPriceEmbed();
  
  let text = `📊 **Harga Emas Hari Ini**\n\n`;
  
  for (const field of embed.fields) {
    if (!field.name.includes('Info')) {
      text += `${field.name}\n${field.value}\n\n`;
    }
  }
  
  return text;
}

export default {
  getGoldPriceEmbed,
  getGoldPriceText,
};
