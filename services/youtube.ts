import { ApifyClient } from 'apify-client';

export class YouTubeService {
  private apify: ApifyClient;

  constructor() {
    this.apify = new ApifyClient({
      token: process.env.APIFY_API_TOKEN,
    });
  }

  async extractTranscript(youtubeUrl: string): Promise<{
    title: string;
    transcript: string;
    duration?: string;
    channelName?: string;
  }> {
    try {
      console.log(`Starting YouTube transcript extraction for: ${youtubeUrl}`);

      // Run the YouTube transcript actor
      const run = await this.apify.actor('pintostudio/youtube-transcript-scraper').call({
        videoUrl: youtubeUrl
      });

      // Wait for the run to finish and fetch results
      const { items } = await this.apify.dataset(run.defaultDatasetId).listItems();
      
      if (!items || items.length === 0) {
        throw new Error('No transcript data found');
      }

      const result = items[0] as any;
      
      // Handle pintostudio actor response format
      let transcriptData;
      let fullTranscript = '';
      let videoTitle = 'YouTube Video';
      let videoDuration = '';
      let channelName = 'Unknown Channel';
      
      if (result.data && Array.isArray(result.data)) {
        // Extract transcript from array format
        transcriptData = result.data;
        fullTranscript = transcriptData.map((item: any) => item.text).join(' ');
        
        // Calculate duration from last timestamp
        if (transcriptData.length > 0) {
          const lastItem = transcriptData[transcriptData.length - 1];
          if (lastItem.start && lastItem.dur) {
            const endTime = parseFloat(lastItem.start) + parseFloat(lastItem.dur);
            videoDuration = `${Math.floor(endTime / 60)}:${Math.floor(endTime % 60).toString().padStart(2, '0')}`;
          }
        }
        
        // Try to get video metadata using YouTube API
        try {
          const videoId = this.extractVideoId(youtubeUrl);
          if (videoId) {
            videoTitle = result.title || await this.getVideoTitle(videoId);
            channelName = result.channelName || await this.getChannelName(videoId);
          }
        } catch (error) {
          console.log('Could not fetch video metadata:', error instanceof Error ? error.message : String(error));
        }
      } else if (result.transcript) {
        fullTranscript = result.transcript;
        videoTitle = result.title || videoTitle;
        videoDuration = result.duration || videoDuration;
        channelName = result.channelName || result.channel || channelName;
      }
      
      console.log(`YouTube transcript extracted successfully:`, {
        title: videoTitle,
        transcriptLength: fullTranscript.length,
        duration: videoDuration,
        segments: transcriptData?.length || 0
      });

      return {
        title: videoTitle,
        transcript: fullTranscript,
        duration: videoDuration,
        channelName: channelName
      };

    } catch (error: unknown) {
      console.error('YouTube transcript extraction failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to extract YouTube transcript: ${errorMessage}`);
    }
  }

  // Extract video ID from YouTube URL
  private extractVideoId(url: string): string | null {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  // Validate YouTube URL
  isValidYouTubeUrl(url: string): boolean {
    return this.extractVideoId(url) !== null;
  }

  // Get video title using simple method
  private async getVideoTitle(videoId: string): Promise<string> {
    try {
      // Try to fetch title from YouTube's oembed API
      const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      if (response.ok) {
        const data = await response.json();
        return data.title || 'YouTube Video';
      }
      return 'YouTube Video';
    } catch (error) {
      console.log('Failed to fetch video title:', error);
      return 'YouTube Video';
    }
  }

  // Get channel name using simple method  
  private async getChannelName(videoId: string): Promise<string> {
    try {
      // Try to fetch channel from YouTube's oembed API
      const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      if (response.ok) {
        const data = await response.json();
        return data.author_name || 'Unknown Channel';
      }
      return 'Unknown Channel';
    } catch (error) {
      console.log('Failed to fetch channel name:', error);
      return 'Unknown Channel';
    }
  }
}