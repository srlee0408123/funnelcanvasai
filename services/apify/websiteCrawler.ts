import { apifyClient } from './client';

export interface CrawlResult {
  url: string;
  title?: string;
  text: string;
  html?: string;
  markdown?: string;
  success: boolean;
  error?: string;
}

/**
 * apify/websiteCrawler - 웹사이트 콘텐츠 크롤링 (Playwright)
 */
export async function crawlWebsite(url: string): Promise<CrawlResult> {
  try {
    const run = await apifyClient.actor('apify/website-content-crawler').call({
      startUrls: [{ url }],
      crawlerType: 'playwright:chrome',
      maxCrawlDepth: 0,
      maxCrawlPages: 1,
      initialConcurrency: 1,
      maxConcurrency: 1,
      removeElementsCssSelector:
        'nav, header, footer, .navigation, .menu, .sidebar, .ad, .advertisement, script, style, noscript, .cookie-banner, .popup',
      onlyHtmlContent: true,
      maxScrollHeightPixels: 5000,
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    if (items && items.length > 0) {
      const item = items[0] as any;
      return {
        url,
        title: item.title,
        text: item.text || '',
        html: item.html || '',
        markdown: item.markdown || '',
        success: true,
      };
    }

    return { url, text: '', success: false, error: 'No content found' };
  } catch (error) {
    return {
      url,
      text: '',
      success: false,
      error: (error as Error).message,
    };
  }
}


