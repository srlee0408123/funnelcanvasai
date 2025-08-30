import { ApifyClient } from 'apify-client';

export interface CrawlResult {
  url: string;
  title?: string;
  text: string;
  html?: string;
  markdown?: string;
  success: boolean;
  error?: string;
}

export class ApifyCrawler {
  private client: ApifyClient;

  constructor() {
    this.client = new ApifyClient({
      token: process.env.APIFY_API_TOKEN,
    });
  }

  async crawlWebsite(url: string): Promise<CrawlResult> {
    try {
      console.log(`🚀 Starting Apify crawl for: ${url}`);
      
      const run = await this.client.actor('apify/website-content-crawler').call({
        startUrls: [{ url: url }],
        crawlerType: 'playwright:chrome',
        maxCrawlDepth: 0,
        maxCrawlPages: 1,
        initialConcurrency: 1,
        maxConcurrency: 1,
        removeElementsCssSelector: 'nav, header, footer, .navigation, .menu, .sidebar, .ad, .advertisement, script, style, noscript, .cookie-banner, .popup',
        onlyHtmlContent: true,
        maxScrollHeightPixels: 5000,
      });

      console.log(`📝 Apify run started: ${run.id}`);

      // Wait for completion with timeout
      const result = await this.waitForCompletion(run.id, 180); // 3 minutes timeout
      
      if (result) {
        console.log(`✅ Successfully crawled ${url}: ${result.text.length} characters`);
        return {
          url,
          title: result.title,
          text: result.text,
          html: result.html,
          markdown: result.markdown,
          success: true
        };
      } else {
        return {
          url,
          text: '',
          success: false,
          error: 'Crawling timeout or no content found'
        };
      }

    } catch (error) {
      console.error(`❌ Apify crawling failed for ${url}:`, error);
      return {
        url,
        text: '',
        success: false,
        error: (error as Error).message
      };
    }
  }

  private async waitForCompletion(runId: string, timeoutSeconds: number) {
    const startTime = Date.now();
    const timeoutMs = timeoutSeconds * 1000;
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const runInfo = await this.client.run(runId).get();
        
        if (runInfo && runInfo.status === 'SUCCEEDED') {
          const { items } = await this.client.dataset(runInfo.defaultDatasetId).listItems();
          
          if (items && items.length > 0) {
            const item = items[0] as any;
            return {
              title: item.title,
              text: item.text || '',
              html: item.html || '',
              markdown: item.markdown || ''
            };
          }
          return null;
        } else if (runInfo && runInfo.status === 'FAILED') {
          throw new Error('Apify run failed');
        }
        
        // Wait 3 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error) {
        console.warn('Error checking run status:', error);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    throw new Error('Crawling timeout');
  }

  async crawlMultipleUrls(urls: string[]): Promise<CrawlResult[]> {
    const results = await Promise.allSettled(
      urls.map(url => this.crawlWebsite(url))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          url: urls[index],
          text: '',
          success: false,
          error: result.reason?.message || 'Unknown error'
        };
      }
    });
  }
}