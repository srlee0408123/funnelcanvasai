import { apifyClient } from './client';

/**
 * apify/youtubeTranscript - YouTube 자막 및 메타데이터 추출
 */
export async function extractYouTubeTranscript(youtubeUrl: string): Promise<{
  title: string;
  transcript: string;
  duration?: string;
  channelName?: string;
}> {
  try {
    const run = await apifyClient.actor('pintostudio/youtube-transcript-scraper').call({
      videoUrl: youtubeUrl,
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    if (!items || items.length === 0) {
      throw new Error('No transcript data found');
    }

    const result = items[0] as any;

    let transcriptData;
    let fullTranscript = '';
    let videoTitle = 'YouTube Video';
    let videoDuration = '';
    let channelName = 'Unknown Channel';

    if (result.data && Array.isArray(result.data)) {
      transcriptData = result.data;
      fullTranscript = transcriptData.map((item: any) => item.text).join(' ');
      if (transcriptData.length > 0) {
        const lastItem = transcriptData[transcriptData.length - 1];
        if (lastItem.start && lastItem.dur) {
          const endTime = parseFloat(lastItem.start) + parseFloat(lastItem.dur);
          videoDuration = `${Math.floor(endTime / 60)}:${Math.floor(endTime % 60).toString().padStart(2, '0')}`;
        }
      }

      // Try metadata via oEmbed
      try {
        const videoId = extractVideoId(youtubeUrl);
        if (videoId) {
          videoTitle = result.title || await getVideoTitle(videoId);
          channelName = result.channelName || await getChannelName(videoId);
        }
      } catch {}
    } else if (result.transcript) {
      fullTranscript = result.transcript;
      videoTitle = result.title || videoTitle;
      videoDuration = result.duration || videoDuration;
      channelName = result.channelName || result.channel || channelName;
    }

    return {
      title: videoTitle,
      transcript: fullTranscript,
      duration: videoDuration,
      channelName,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to extract YouTube transcript: ${message}`);
  }
}

export function isValidYouTubeUrl(url: string): boolean {
  return extractVideoId(url) !== null;
}

function extractVideoId(url: string): string | null {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

async function getVideoTitle(videoId: string): Promise<string> {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (response.ok) {
      const data = await response.json();
      return data.title || 'YouTube Video';
    }
    return 'YouTube Video';
  } catch {
    return 'YouTube Video';
  }
}

async function getChannelName(videoId: string): Promise<string> {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (response.ok) {
      const data = await response.json();
      return data.author_name || 'Unknown Channel';
    }
    return 'Unknown Channel';
  } catch {
    return 'Unknown Channel';
  }
}


