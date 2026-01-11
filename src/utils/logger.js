/**
 * Logger Utility
 * Clean and focused logging
 */

function timestamp() {
  const now = new Date();
  return now.toLocaleTimeString('id-ID', { hour12: false });
}

function formatMessage(tag, msg) {
  return `[${tag}] ${timestamp()} | ${msg}`;
}

export const log = {
  info: (tag, msg) => {
    console.log(formatMessage(tag, msg));
  },

  error: (tag, msg) => {
    console.error(formatMessage(tag, msg));
  },

  warn: (tag, msg) => {
    console.warn(formatMessage(tag, msg));
  },

  debug: (tag, msg) => {
    if (process.env.DEBUG === 'true') {
      console.log(formatMessage('DEBUG', msg));
    }
  },

  ai: (msg) => {
    // Only show success messages
    if (msg.includes('received')) {
      console.log(formatMessage('AI', msg));
    }
  },

  discord: (msg) => {
    console.log(formatMessage('BOT', msg));
  },
};

export default log;
