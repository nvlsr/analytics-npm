export type BotCategory = 'SEO' | 'SOCIAL' | 'AI' | 'UNKNOWN';

export interface BotInfo {
  name: string;
  category: BotCategory;
}
export const BOT_REGISTRY: Record<string, BotInfo> = {
  'gptbot': { name: 'openai-bot', category: 'AI' },
  'chatgpt': { name: 'chatgpt-bot', category: 'AI' },
  'openai': { name: 'openai-bot', category: 'AI' },
  'claudebot': { name: 'claude-bot', category: 'AI' },
  'claude-web': { name: 'claude-web', category: 'AI' },
  'anthropic': { name: 'anthropic-bot', category: 'AI' },
  'perplexitybot': { name: 'perplexity-bot', category: 'AI' },
  'perplexity': { name: 'perplexity-bot', category: 'AI' },
  'meta-externalagent': { name: 'meta-ai', category: 'AI' },
  'cohere': { name: 'cohere-bot', category: 'AI' },
  'ai2bot': { name: 'ai2-bot', category: 'AI' },
  'google-extended': { name: 'google-ai', category: 'AI' },
  'googlebot': { name: 'google-bot', category: 'SEO' },
  'bingbot': { name: 'bing-bot', category: 'SEO' },
  'yandexbot': { name: 'yandex-bot', category: 'SEO' },
  'baiduspider': { name: 'baidu-spider', category: 'SEO' },
  'duckduckbot': { name: 'duckduckgo-bot', category: 'SEO' },
  'applebot': { name: 'apple-bot', category: 'SEO' },
  'slurp': { name: 'yahoo-bot', category: 'SEO' },
  'crawler': { name: 'web-crawler', category: 'SEO' },
  'spider': { name: 'web-spider', category: 'SEO' },
  'indexer': { name: 'search-indexer', category: 'SEO' },
  'search': { name: 'search-bot', category: 'SEO' },
  'facebookexternalhit': { name: 'facebook-bot', category: 'SOCIAL' },
  'twitterbot': { name: 'twitter-bot', category: 'SOCIAL' },
  'linkedinbot': { name: 'linkedin-bot', category: 'SOCIAL' },
  'whatsapp': { name: 'whatsapp-bot', category: 'SOCIAL' },
  'telegrambot': { name: 'telegram-bot', category: 'SOCIAL' },
  'skypebot': { name: 'skype-bot', category: 'SOCIAL' },
  'slackbot': { name: 'slack-bot', category: 'SOCIAL' },
  'discordbot': { name: 'discord-bot', category: 'SOCIAL' },
  'instagram': { name: 'instagram-bot', category: 'SOCIAL' },
  'tiktok': { name: 'tiktok-bot', category: 'SOCIAL' },
  'snapchat': { name: 'snapchat-bot', category: 'SOCIAL' },
  'pinterest': { name: 'pinterest-bot', category: 'SOCIAL' },
  'vercel-screenshot': { name: 'vercel-screenshot', category: 'SEO' },
  'vercel-favicon': { name: 'vercel-favicon', category: 'SEO' },
  'vercel': { name: 'vercel-bot', category: 'SEO' },
  'screenshot': { name: 'screenshot-bot', category: 'SEO' },
  'preview': { name: 'preview-bot', category: 'SEO' },
  'deploy': { name: 'deployment-bot', category: 'SEO' },
  'headless': { name: 'headless-browser', category: 'SEO' },
  'chromium': { name: 'chromium-bot', category: 'SEO' },
  'playwright': { name: 'playwright-bot', category: 'SEO' },
  'puppeteer': { name: 'puppeteer-bot', category: 'SEO' },
  'selenium': { name: 'selenium-bot', category: 'SEO' },
  'build': { name: 'build-bot', category: 'SEO' },
  'ci': { name: 'ci-bot', category: 'SEO' },
  'netlify': { name: 'netlify-bot', category: 'SEO' },
  'svix': { name: 'svix-webhook', category: 'SEO' },
  'webhook': { name: 'webhook-service', category: 'SEO' },
  'zapier': { name: 'zapier-bot', category: 'SEO' },
  'ifttt': { name: 'ifttt-bot', category: 'SEO' },
  'semrush': { name: 'semrush-bot', category: 'SEO' },
  'ahrefs': { name: 'ahrefs-bot', category: 'SEO' },
  'mj12bot': { name: 'mj12-bot', category: 'SEO' },
  'dotbot': { name: 'dot-bot', category: 'SEO' },
  'screaming frog': { name: 'screaming-frog', category: 'SEO' },
  'sitebulb': { name: 'sitebulb-crawler', category: 'SEO' },
  'lighthouse': { name: 'lighthouse-bot', category: 'SEO' },
  'pagespeed': { name: 'pagespeed-bot', category: 'SEO' },
  'gtmetrix': { name: 'gtmetrix-bot', category: 'SEO' },
  'webpagetest': { name: 'webpagetest-bot', category: 'SEO' },
  'pingdom': { name: 'pingdom-bot', category: 'SEO' },
  'statuscake': { name: 'statuscake-bot', category: 'SEO' },
  'uptimerobot': { name: 'uptime-robot', category: 'SEO' },
  'monitor': { name: 'monitor-bot', category: 'SEO' },
  'scraper': { name: 'scraper-bot', category: 'SEO' },
  'palo alto networks': { name: 'palo-alto-scanner', category: 'SEO' },
  'cortex-xpanse': { name: 'cortex-xpanse-scanner', category: 'SEO' },
  'amazonbot': { name: 'amazon-bot', category: 'SEO' },
  'analyticsbot': { name: 'analytics-bot', category: 'SEO' },
  'duckassistbot': { name: 'duckassist-bot', category: 'SEO' },
  'qwantbot': { name: 'qwant-bot', category: 'SEO' },
  'abevalbot': { name: 'abeval-bot', category: 'SEO' },
  'serpstatbot': { name: 'serpstat-bot', category: 'SEO' },
  'wpbot': { name: 'wp-bot', category: 'SEO' },
  'gaisbot': { name: 'gais-bot', category: 'AI' },
  'ccbot': { name: 'cc-bot', category: 'SEO' },
};

export function extractBotInfo(userAgent: string): BotInfo {
  if (!userAgent) {
    return { name: 'unknown-bot', category: 'UNKNOWN' };
  }

  const lowerUA = userAgent.toLowerCase();

  const sortedPatterns = Object.entries(BOT_REGISTRY)
    .sort(([a], [b]) => b.length - a.length);

  for (const [pattern, botInfo] of sortedPatterns) {
    if (lowerUA.includes(pattern)) {
      return botInfo;
    }
  }

  const botNameMatch = userAgent.match(/(\w+bot)\/\d/i);
  if (botNameMatch) {
    const rawName = botNameMatch[1];
    const slugName = rawName.toLowerCase().replace(/bot$/, '-bot');
    return { name: slugName, category: 'UNKNOWN' };
  }

  const compatibleMatch = userAgent.match(/compatible;\s*([^;\/]+)[\s\/]/i);
  if (compatibleMatch) {
    const rawName = compatibleMatch[1].trim();
    if (rawName.toLowerCase().includes('bot') || rawName.toLowerCase().includes('crawler')) {
      const slugName = rawName.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      return { name: slugName, category: 'UNKNOWN' };
    }
  }

  if (lowerUA.includes('webhook')) {
    return { name: 'webhook-service', category: 'SEO' };
  }

  if (lowerUA.includes('palo alto') || lowerUA.includes('cortex')) {
    return { name: 'palo-alto-scanner', category: 'SEO' };
  }

  return { name: 'unknown-bot', category: 'UNKNOWN' };
}