import { Logger } from '@nestjs/common';

/**
 * 디스코드 웹훅을 통해 에러 알림을 보내는 유틸리티
 */
export async function sendDiscordNotification(webhookUrl: string, payload: {
  title: string;
  description: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  color?: number;
}) {
  const logger = new Logger('DiscordNotifier');
  
  if (!webhookUrl) return;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [
          {
            title: payload.title,
            description: payload.description,
            fields: payload.fields,
            color: payload.color || 0xff0000, // 기본 빨간색
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    if (!response.ok) {
      logger.error(`Discord notification failed: ${response.statusText}`);
    }
  } catch (error) {
    logger.error('Error sending discord notification', error);
  }
}
