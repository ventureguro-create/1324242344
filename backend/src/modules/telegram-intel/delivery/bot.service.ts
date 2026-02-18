/**
 * Telegram Bot Service (PHASE 6)
 * Handles sending push notifications via Telegram Bot API
 * 
 * Uses direct Bot API (not MTProto) for simplicity and reliability
 */
import { TgBotConnectionModel } from './tg_bot_connections.model.js';
import { TgUserAlertModel } from '../models/tg_user_alerts.model.js';

// Configuration from environment
const BOT_TOKEN = process.env.TG_BOT_TOKEN;
const TELEGRAM_API = 'https://api.telegram.org';

interface SendMessageOptions {
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
}

interface TelegramApiResponse {
  ok: boolean;
  result?: any;
  description?: string;
  error_code?: number;
}

/**
 * Send message via Telegram Bot API
 */
async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  options: SendMessageOptions = {}
): Promise<TelegramApiResponse> {
  if (!BOT_TOKEN) {
    return { ok: false, description: 'TG_BOT_TOKEN not configured' };
  }

  const url = `${TELEGRAM_API}/bot${BOT_TOKEN}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options.parse_mode || 'HTML',
        disable_web_page_preview: options.disable_web_page_preview ?? true,
        disable_notification: options.disable_notification ?? false,
      }),
    });

    const data = await response.json() as TelegramApiResponse;
    return data;
  } catch (error: any) {
    return { 
      ok: false, 
      description: error?.message || 'Network error',
      error_code: 500 
    };
  }
}

/**
 * Format alert message for Telegram
 */
function formatAlertMessage(alert: any, lang: string = 'ru'): string {
  const severityEmoji: Record<string, string> = {
    HIGH: '🔴',
    MEDIUM: '🟡',
    LOW: '🟢',
  };

  const emoji = severityEmoji[alert.severity] || '⚪';
  
  // Use existing message or generate one
  let message = alert.message;
  
  if (!message) {
    const typeLabels: Record<string, string> = {
      INTEL_SPIKE: 'Intel Score вырос',
      INTEL_DUMP: 'Intel Score упал',
      MOMENTUM_SPIKE: 'Momentum вырос',
      MOMENTUM_DUMP: 'Momentum упал',
      FRAUD_SPIKE: 'Fraud Risk увеличился',
      TIER_CHANGE: 'Изменение Tier',
      NEW_RISER: 'Новый Riser',
    };
    
    message = `${typeLabels[alert.type] || alert.type}: @${alert.username}`;
    
    if (alert.delta != null) {
      const sign = alert.delta >= 0 ? '+' : '';
      message += ` (${sign}${alert.delta.toFixed(1)})`;
    }
  }

  // Build formatted message
  const lines = [
    `${emoji} <b>${alert.type}</b>`,
    '',
    message,
    '',
    `📊 Канал: @${alert.username}`,
    `📅 ${alert.day}`,
  ];

  if (alert.prev != null && alert.next != null) {
    lines.push(`📈 ${alert.prev?.toFixed?.(1) ?? alert.prev} → ${alert.next?.toFixed?.(1) ?? alert.next}`);
  }

  return lines.join('\n');
}

/**
 * Check if current time is within quiet hours
 */
function isQuietHours(prefs: any): boolean {
  if (!prefs?.quietHours?.enabled) return false;
  
  const now = new Date();
  const hour = now.getUTCHours(); // TODO: handle user timezone
  const start = prefs.quietHours.start ?? 22;
  const end = prefs.quietHours.end ?? 8;

  if (start < end) {
    return hour >= start && hour < end;
  } else {
    // Spans midnight (e.g., 22:00 - 08:00)
    return hour >= start || hour < end;
  }
}

/**
 * Deliver alert to Telegram user
 */
export async function deliverAlertToTelegram(
  alertId: string,
  connectionId: string
): Promise<{ ok: boolean; error?: string }> {
  const [alert, connection] = await Promise.all([
    TgUserAlertModel.findById(alertId).lean(),
    TgBotConnectionModel.findById(connectionId).lean(),
  ]);

  if (!alert) {
    return { ok: false, error: 'alert_not_found' };
  }

  if (!connection) {
    return { ok: false, error: 'connection_not_found' };
  }

  const conn = connection as any;

  // Check if notifications are enabled
  if (!conn.preferences?.enabled || conn.status !== 'active') {
    return { ok: false, error: 'notifications_disabled' };
  }

  // Check severity threshold
  const severityOrder = { LOW: 1, MEDIUM: 2, HIGH: 3 };
  const alertSeverity = severityOrder[(alert as any).severity as keyof typeof severityOrder] || 1;
  const minSeverity = severityOrder[conn.preferences?.minSeverity as keyof typeof severityOrder] || 2;
  
  if (alertSeverity < minSeverity) {
    return { ok: false, error: 'below_severity_threshold' };
  }

  // Check alert type filter
  if (conn.preferences?.alertTypes?.length > 0) {
    if (!conn.preferences.alertTypes.includes((alert as any).type)) {
      return { ok: false, error: 'alert_type_filtered' };
    }
  }

  // Check quiet hours
  if (isQuietHours(conn.preferences)) {
    return { ok: false, error: 'quiet_hours' };
  }

  // Format and send message
  const message = formatAlertMessage(alert, conn.preferences?.language);
  const result = await sendTelegramMessage(conn.telegramUserId, message);

  // Update stats
  if (result.ok) {
    await TgBotConnectionModel.findByIdAndUpdate(connectionId, {
      $inc: { 'stats.alertsSent': 1 },
      $set: { 'stats.lastAlertAt': new Date() },
    });

    // Mark alert as delivered
    await TgUserAlertModel.findByIdAndUpdate(alertId, {
      $set: { 'delivered.telegram': true },
    });

    return { ok: true };
  } else {
    await TgBotConnectionModel.findByIdAndUpdate(connectionId, {
      $inc: { 'stats.errorCount': 1 },
      $set: { 
        'stats.lastErrorAt': new Date(),
        'stats.lastErrorMessage': result.description,
      },
    });

    // Handle blocked user
    if (result.error_code === 403) {
      await TgBotConnectionModel.findByIdAndUpdate(connectionId, {
        $set: { status: 'blocked' },
      });
    }

    return { ok: false, error: result.description };
  }
}

/**
 * Deliver alerts to all connected Telegram users
 * Called by alerts engine after generating alerts
 */
export async function deliverPendingAlerts(opts?: {
  limit?: number;
  dryRun?: boolean;
}): Promise<{
  ok: boolean;
  total: number;
  delivered: number;
  failed: number;
  skipped: number;
  errors: string[];
}> {
  const limit = opts?.limit ?? 100;
  const dryRun = opts?.dryRun ?? false;

  // Find undelivered alerts
  const pendingAlerts = await TgUserAlertModel.find({
    'delivered.telegram': false,
    read: false,
    createdAt: { $gte: new Date(Date.now() - 24 * 3600 * 1000) }, // Last 24h
  })
    .sort({ severity: -1, createdAt: -1 })
    .limit(limit)
    .lean();

  if (pendingAlerts.length === 0) {
    return { ok: true, total: 0, delivered: 0, failed: 0, skipped: 0, errors: [] };
  }

  // Get unique actor IDs
  const actorIds = [...new Set(pendingAlerts.map((a: any) => a.actorId))];

  // Find active Telegram connections for these actors
  const connections = await TgBotConnectionModel.find({
    actorId: { $in: actorIds },
    status: 'active',
    'preferences.enabled': true,
  }).lean();

  const connectionMap = new Map(connections.map((c: any) => [c.actorId, c]));

  let delivered = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const alert of pendingAlerts) {
    const connection = connectionMap.get((alert as any).actorId);
    
    if (!connection) {
      skipped++;
      continue;
    }

    if (dryRun) {
      delivered++;
      continue;
    }

    const result = await deliverAlertToTelegram(
      String((alert as any)._id),
      String((connection as any)._id)
    );

    if (result.ok) {
      delivered++;
    } else if (result.error === 'below_severity_threshold' || 
               result.error === 'alert_type_filtered' ||
               result.error === 'quiet_hours') {
      skipped++;
    } else {
      failed++;
      errors.push(`${(alert as any).username}: ${result.error}`);
    }

    // Rate limit: 30 messages per second
    await new Promise(r => setTimeout(r, 35));
  }

  return {
    ok: true,
    total: pendingAlerts.length,
    delivered,
    failed,
    skipped,
    errors: errors.slice(0, 10),
  };
}

/**
 * Get bot info
 */
export async function getBotInfo(): Promise<any> {
  if (!BOT_TOKEN) {
    return { ok: false, error: 'TG_BOT_TOKEN not configured' };
  }

  const url = `${TELEGRAM_API}/bot${BOT_TOKEN}/getMe`;
  
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error: any) {
    return { ok: false, error: error?.message };
  }
}

/**
 * Set webhook for bot updates
 */
export async function setWebhook(webhookUrl: string): Promise<any> {
  if (!BOT_TOKEN) {
    return { ok: false, error: 'TG_BOT_TOKEN not configured' };
  }

  const url = `${TELEGRAM_API}/bot${BOT_TOKEN}/setWebhook`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
      }),
    });
    return await response.json();
  } catch (error: any) {
    return { ok: false, error: error?.message };
  }
}

/**
 * Send test notification to a user
 */
export async function sendTestNotification(telegramUserId: number): Promise<any> {
  const testMessage = `
🔔 <b>Тестовое уведомление</b>

Это тестовое сообщение от Telegram Intel Bot.

Вы успешно подключили уведомления! Теперь вы будете получать алерты о каналах в вашем Watchlist.

📊 Настройте уведомления: /settings
❓ Помощь: /help
`;

  return sendTelegramMessage(telegramUserId, testMessage.trim());
}
