/**
 * Image Generation Service
 * Using Pollinations.ai - Free, No API Key Required
 */

import { log } from '../utils/logger.js';

// Default settings
const DEFAULTS = {
  width: 1024,
  height: 1024,
  model: 'flux',
};

// Size presets
const SIZE_PRESETS = {
  square: { width: 1024, height: 1024 },
  portrait: { width: 768, height: 1024 },
  landscape: { width: 1024, height: 768 },
  wide: { width: 1280, height: 720 },
  tall: { width: 720, height: 1280 },
};

// Max dimensions (to prevent abuse)
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;
const MIN_SIZE = 256;

/**
 * Validate and clamp dimensions
 */
function validateDimensions(width, height) {
  const w = Math.min(Math.max(width || DEFAULTS.width, MIN_SIZE), MAX_WIDTH);
  const h = Math.min(Math.max(height || DEFAULTS.height, MIN_SIZE), MAX_HEIGHT);
  return { width: w, height: h };
}

/**
 * Generate image URL from Pollinations.ai
 */
export function generateImageUrl(prompt, options = {}) {
  const { width, height } = validateDimensions(options.width, options.height);
  const seed = options.seed || Math.floor(Math.random() * 999999);
  
  // Encode prompt for URL
  const encodedPrompt = encodeURIComponent(prompt);
  
  // Build URL with parameters
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
  
  log.info('IMAGE', `Generating: ${width}x${height} - "${prompt.substring(0, 50)}..."`);
  
  return {
    url,
    width,
    height,
    seed,
  };
}

/**
 * Get size preset by name
 */
export function getSizePreset(name) {
  return SIZE_PRESETS[name.toLowerCase()] || null;
}

/**
 * Get available presets for display
 */
export function getAvailablePresets() {
  return Object.keys(SIZE_PRESETS);
}

export default {
  generateImageUrl,
  getSizePreset,
  getAvailablePresets,
  DEFAULTS,
  SIZE_PRESETS,
};
