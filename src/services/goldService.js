/**
 * Gold Price Service
 * Fetch gold prices from harga-emas.org
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { log } from '../utils/logger.js';

/**
 * Fetch all gold prices from harga-emas.org
 */
async function fetchGoldPrices() {
  try {
    const response = await axios.get('https://harga-emas.org/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    const text = $('body').text();

    // Get date from page - "Pada 18 Jan 2026"
    let dateText = '';
    const dateMatch = text.match(/Pada\s+(\d{1,2}\s+\w+\s+\d{4})/i);
    if (dateMatch) {
      dateText = dateMatch[1];
    }

    // Initialize prices
    const spotPrices = {
      usd: { perOz: null, perGram: null },
      idr: { perOz: null, perGram: null, kurs: null }
    };

    // Parse USD prices
    const usdMatches = text.match(/\$[\d.,]+/g);
    if (usdMatches) {
      for (const match of usdMatches) {
        const value = match.replace('$', '');
        // Convert Indonesian format (4.596,34) to number
        const numValue = parseFloat(value.replace(/\./g, '').replace(',', '.'));
        
        if (numValue > 1000 && numValue < 10000 && !spotPrices.usd.perOz) {
          // Per ounce (around 4000-5000)
          spotPrices.usd.perOz = value;
        } else if (numValue > 100 && numValue < 500 && !spotPrices.usd.perGram) {
          // Per gram (around 100-200)
          spotPrices.usd.perGram = value;
        }
      }
    }

    // Parse IDR prices
    const idrMatches = text.match(/Rp[\d.,]+/g);
    if (idrMatches) {
      for (const match of idrMatches) {
        const value = match.replace('Rp', '');
        // Convert to number
        const numValue = parseFloat(value.replace(/\./g, '').replace(',', '.'));
        
        if (numValue > 50000000 && numValue < 200000000 && !spotPrices.idr.perOz) {
          // Per ounce (around 70-80 million)
          spotPrices.idr.perOz = value;
        } else if (numValue > 2000000 && numValue < 5000000 && !spotPrices.idr.perGram) {
          // Per gram (around 2-3 million)
          spotPrices.idr.perGram = value;
        } else if (numValue > 15000 && numValue < 20000 && !spotPrices.idr.kurs) {
          // Kurs USD/IDR (around 15000-17000)
          spotPrices.idr.kurs = value;
        }
      }
    }

    // Parse Antam prices from table
    const antamPrices = [];
    $('table').each((i, table) => {
      const tableText = $(table).text().toLowerCase();
      // Look for Antam table
      if (tableText.includes('antam') || tableText.includes('beli') || tableText.includes('jual')) {
        $(table).find('tr').each((j, row) => {
          const cols = $(row).find('td');
          if (cols.length >= 2) {
            const col1 = $(cols[0]).text().trim();
            const col2 = $(cols[1]).text().trim();
            
            // Check if first column contains weight (e.g., "1 gr", "0,5 gr", "10 gr")
            if (col1.match(/[\d,]+\s*(gr|gram)/i) && col2.match(/[\d.,]+/)) {
              antamPrices.push({
                weight: col1,
                price: col2.includes('Rp') ? col2 : `Rp${col2}`,
              });
            }
          }
        });
      }
    });

    log.info('GOLD', `Fetched: ${dateText}, IDR/gr: ${spotPrices.idr.perGram}`);

    return {
      success: true,
      date: dateText,
      spot: spotPrices,
      antam: antamPrices.slice(0, 8),
      source: 'harga-emas.org',
    };

  } catch (error) {
    log.error('GOLD', `Fetch error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get gold prices embed
 */
export async function getGoldPriceEmbed() {
  const data = await fetchGoldPrices();
  
  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });

  const fields = [];

  if (data.success) {
    // Spot Prices - USD
    if (data.spot.usd.perOz || data.spot.usd.perGram) {
      const usdValues = [];
      if (data.spot.usd.perOz) usdValues.push(`💵 **/oz:** $${data.spot.usd.perOz}`);
      if (data.spot.usd.perGram) usdValues.push(`💵 **/gram:** $${data.spot.usd.perGram}`);
      
      fields.push({
        name: '🇺🇸 USD (Spot Dunia)',
        value: usdValues.join('\n'),
        inline: true,
      });
    }

    // Spot Prices - IDR
    if (data.spot.idr.perOz || data.spot.idr.perGram) {
      const idrValues = [];
      if (data.spot.idr.perOz) idrValues.push(`💰 **/oz:** Rp${data.spot.idr.perOz}`);
      if (data.spot.idr.perGram) idrValues.push(`💰 **/gram:** Rp${data.spot.idr.perGram}`);
      
      fields.push({
        name: '🇮🇩 IDR (Spot Dunia)',
        value: idrValues.join('\n'),
        inline: true,
      });
    }

    // Kurs
    if (data.spot.idr.kurs) {
      fields.push({
        name: '💱 Kurs',
        value: `1 USD = Rp${data.spot.idr.kurs}`,
        inline: true,
      });
    }

    // Antam Prices
    if (data.antam && data.antam.length > 0) {
      const antamList = data.antam
        .slice(0, 6)
        .map(p => `${p.weight}: **${p.price}**`)
        .join('\n');

      fields.push({
        name: '🏅 Harga Emas Antam',
        value: antamList,
        inline: false,
      });
    }

  } else {
    fields.push({
      name: '⚠️ Error',
      value: 'Gagal mengambil data. Coba lagi nanti.',
      inline: false,
    });
  }

  // Info
  fields.push({
    name: '💡 Info',
    value: '```Harga dapat berubah sewaktu-waktu.```',
    inline: false,
  });

  const embed = {
    color: 0xFFD700, // Gold color
    title: '📊 Harga Emas Hari Ini',
    description: `📅 **${data.date || 'Hari ini'}**\n🕐 Update: ${timeStr} WIB`,
    fields,
    footer: {
      text: `Sumber: ${data.source || 'harga-emas.org'}`,
    },
    timestamp: now.toISOString(),
  };

  return embed;
}

/**
 * Get gold prices as text
 */
export async function getGoldPriceText() {
  const embed = await getGoldPriceEmbed();
  
  let text = `📊 **Harga Emas Hari Ini**\n${embed.description}\n\n`;
  
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
