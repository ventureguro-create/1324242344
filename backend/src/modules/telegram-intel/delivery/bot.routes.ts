/**
 * Telegram Bot Routes (PHASE 6)
 * API endpoints for bot connections and delivery management
 */
import { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import { TgBotConnectionModel } from './tg_bot_connections.model.js';
import { resolveActor } from '../watchlist/actor.resolver.js';
import * as BotService from './bot.service.js';

export const botRoutes: FastifyPluginAsync = async (fastify) => {

  // ==================== User Routes ====================

  /**
   * GET /api/telegram-intel/bot/status
   * Get bot status and user connection status
   */
  fastify.get('/api/telegram-intel/bot/status', async (req) => {
    const actor = resolveActor(req);
    
    const connection = await TgBotConnectionModel.findOne({
      actorId: actor.actorId,
    }).lean();

    const botInfo = await BotService.getBotInfo();

    return {
      ok: true,
      bot: {
        configured: botInfo.ok,
        username: botInfo.result?.username,
      },
      connection: connection ? {
        status: (connection as any).status,
        telegramUsername: (connection as any).telegramUsername,
        preferences: (connection as any).preferences,
        stats: (connection as any).stats,
        connectedAt: (connection as any).connectedAt,
      } : null,
    };
  });

  /**
   * POST /api/telegram-intel/bot/connect
   * Generate link token for connecting Telegram account
   */
  fastify.post('/api/telegram-intel/bot/connect', async (req) => {
    const actor = resolveActor(req);
    
    // Generate unique link token
    const linkToken = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Upsert connection with link token
    await TgBotConnectionModel.findOneAndUpdate(
      { actorId: actor.actorId },
      {
        $set: {
          linkToken,
          linkTokenExpires: expiresAt,
          actorType: actor.actorType,
        },
        $setOnInsert: {
          actorId: actor.actorId,
          status: 'pending',
          preferences: {
            enabled: true,
            minSeverity: 'MEDIUM',
            alertTypes: ['INTEL_SPIKE', 'INTEL_DUMP', 'MOMENTUM_SPIKE', 'TIER_CHANGE'],
          },
        },
      },
      { upsert: true, new: true }
    );

    const botInfo = await BotService.getBotInfo();
    const botUsername = botInfo.result?.username || 'TelegramIntelBot';

    return {
      ok: true,
      linkToken,
      expiresAt: expiresAt.toISOString(),
      botUsername,
      connectUrl: `https://t.me/${botUsername}?start=${linkToken}`,
    };
  });

  /**
   * DELETE /api/telegram-intel/bot/disconnect
   * Disconnect Telegram notifications
   */
  fastify.delete('/api/telegram-intel/bot/disconnect', async (req) => {
    const actor = resolveActor(req);
    
    const result = await TgBotConnectionModel.findOneAndUpdate(
      { actorId: actor.actorId },
      { $set: { status: 'paused' } }
    );

    return {
      ok: true,
      disconnected: !!result,
    };
  });

  /**
   * PATCH /api/telegram-intel/bot/preferences
   * Update notification preferences
   */
  fastify.patch('/api/telegram-intel/bot/preferences', async (req) => {
    const actor = resolveActor(req);
    const body = (req.body as any) || {};

    const updates: any = {};
    
    if (typeof body.enabled === 'boolean') {
      updates['preferences.enabled'] = body.enabled;
    }
    if (body.minSeverity) {
      updates['preferences.minSeverity'] = body.minSeverity;
    }
    if (Array.isArray(body.alertTypes)) {
      updates['preferences.alertTypes'] = body.alertTypes;
    }
    if (body.quietHours) {
      if (typeof body.quietHours.enabled === 'boolean') {
        updates['preferences.quietHours.enabled'] = body.quietHours.enabled;
      }
      if (typeof body.quietHours.start === 'number') {
        updates['preferences.quietHours.start'] = body.quietHours.start;
      }
      if (typeof body.quietHours.end === 'number') {
        updates['preferences.quietHours.end'] = body.quietHours.end;
      }
    }
    if (body.language) {
      updates['preferences.language'] = body.language;
    }

    if (Object.keys(updates).length === 0) {
      return { ok: false, error: 'no_updates' };
    }

    const result = await TgBotConnectionModel.findOneAndUpdate(
      { actorId: actor.actorId },
      { $set: updates },
      { new: true }
    );

    if (!result) {
      return { ok: false, error: 'not_connected' };
    }

    return {
      ok: true,
      preferences: (result as any).preferences,
    };
  });

  /**
   * POST /api/telegram-intel/bot/test
   * Send test notification
   */
  fastify.post('/api/telegram-intel/bot/test', async (req) => {
    const actor = resolveActor(req);
    
    const connection = await TgBotConnectionModel.findOne({
      actorId: actor.actorId,
      status: 'active',
    }).lean();

    if (!connection) {
      return { ok: false, error: 'not_connected' };
    }

    const result = await BotService.sendTestNotification((connection as any).telegramUserId);
    
    return {
      ok: result.ok,
      error: result.ok ? undefined : result.description,
    };
  });

  // ==================== Webhook Route ====================

  /**
   * POST /api/telegram-intel/bot/webhook
   * Handle incoming updates from Telegram Bot API
   */
  fastify.post('/api/telegram-intel/bot/webhook', async (req, reply) => {
    const update = req.body as any;
    
    try {
      // Handle /start command with link token
      if (update.message?.text?.startsWith('/start ')) {
        const linkToken = update.message.text.substring(7).trim();
        const telegramUser = update.message.from;

        if (linkToken && telegramUser) {
          // Find pending connection with this token
          const connection = await TgBotConnectionModel.findOneAndUpdate(
            {
              linkToken,
              linkTokenExpires: { $gt: new Date() },
            },
            {
              $set: {
                telegramUserId: telegramUser.id,
                telegramUsername: telegramUser.username,
                telegramFirstName: telegramUser.first_name,
                telegramLastName: telegramUser.last_name,
                status: 'active',
                connectedAt: new Date(),
              },
              $unset: { linkToken: 1, linkTokenExpires: 1 },
            },
            { new: true }
          );

          if (connection) {
            await BotService.sendTestNotification(telegramUser.id);
          } else {
            // Invalid or expired token
            const BOT_TOKEN = process.env.TG_BOT_TOKEN;
            if (BOT_TOKEN) {
              await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: telegramUser.id,
                  text: '❌ Ссылка устарела или недействительна. Пожалуйста, получите новую ссылку на сайте.',
                }),
              });
            }
          }
        }
      }

      // Handle /start without token
      if (update.message?.text === '/start') {
        const telegramUser = update.message.from;
        const BOT_TOKEN = process.env.TG_BOT_TOKEN;
        if (BOT_TOKEN && telegramUser) {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramUser.id,
              text: `👋 Привет, ${telegramUser.first_name}!\n\nЯ Telegram Intel Bot. Для подключения уведомлений, пожалуйста, используйте кнопку "Подключить Telegram" на сайте.`,
              parse_mode: 'HTML',
            }),
          });
        }
      }

      // Handle /settings command
      if (update.message?.text === '/settings') {
        const telegramUser = update.message.from;
        const connection = await TgBotConnectionModel.findOne({
          telegramUserId: telegramUser?.id,
        }).lean();

        const BOT_TOKEN = process.env.TG_BOT_TOKEN;
        if (BOT_TOKEN && telegramUser) {
          let text: string;
          
          if (connection) {
            const conn = connection as any;
            text = `⚙️ <b>Настройки уведомлений</b>\n\n` +
              `📬 Статус: ${conn.status === 'active' ? '✅ Активен' : '⏸ Приостановлен'}\n` +
              `🔔 Уведомления: ${conn.preferences?.enabled ? 'Вкл' : 'Выкл'}\n` +
              `📊 Мин. важность: ${conn.preferences?.minSeverity || 'MEDIUM'}\n` +
              `🌙 Тихие часы: ${conn.preferences?.quietHours?.enabled ? 'Вкл' : 'Выкл'}\n\n` +
              `Для изменения настроек используйте сайт.`;
          } else {
            text = '❌ Вы не подключены к боту. Используйте кнопку "Подключить Telegram" на сайте.';
          }

          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramUser.id,
              text,
              parse_mode: 'HTML',
            }),
          });
        }
      }

      // Handle /help command
      if (update.message?.text === '/help') {
        const telegramUser = update.message.from;
        const BOT_TOKEN = process.env.TG_BOT_TOKEN;
        if (BOT_TOKEN && telegramUser) {
          const helpText = `
📚 <b>Telegram Intel Bot</b>

Я отправляю уведомления о каналах в вашем Watchlist.

<b>Команды:</b>
/start - Начать работу
/settings - Настройки уведомлений
/help - Эта справка

<b>Типы алертов:</b>
📈 INTEL_SPIKE - рост Intel Score
📉 INTEL_DUMP - падение Intel Score
🚀 MOMENTUM_SPIKE - рост Momentum
⚠️ MOMENTUM_DUMP - падение Momentum
🚨 FRAUD_SPIKE - рост Fraud Risk
⬆️ TIER_CHANGE - изменение Tier
🌟 NEW_RISER - новый Rising Star

Настройте уведомления на сайте!
`;

          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramUser.id,
              text: helpText.trim(),
              parse_mode: 'HTML',
            }),
          });
        }
      }

      // Handle /stop command
      if (update.message?.text === '/stop') {
        const telegramUser = update.message.from;
        
        await TgBotConnectionModel.findOneAndUpdate(
          { telegramUserId: telegramUser?.id },
          { $set: { status: 'paused' } }
        );

        const BOT_TOKEN = process.env.TG_BOT_TOKEN;
        if (BOT_TOKEN && telegramUser) {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramUser.id,
              text: '⏸ Уведомления приостановлены. Используйте /start на сайте для повторного подключения.',
            }),
          });
        }
      }

    } catch (error) {
      fastify.log.error(error, '[bot-webhook] Error processing update');
    }

    return reply.status(200).send({ ok: true });
  });

  // ==================== Admin Routes ====================

  /**
   * POST /api/admin/telegram-intel/bot/deliver
   * Run alert delivery job
   */
  fastify.post('/api/admin/telegram-intel/bot/deliver', async (req) => {
    const body = (req.body as any) || {};
    return BotService.deliverPendingAlerts({
      limit: body.limit,
      dryRun: body.dryRun,
    });
  });

  /**
   * GET /api/admin/telegram-intel/bot/stats
   * Get bot statistics
   */
  fastify.get('/api/admin/telegram-intel/bot/stats', async () => {
    const [botInfo, connectionStats] = await Promise.all([
      BotService.getBotInfo(),
      TgBotConnectionModel.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            paused: { $sum: { $cond: [{ $eq: ['$status', 'paused'] }, 1, 0] } },
            blocked: { $sum: { $cond: [{ $eq: ['$status', 'blocked'] }, 1, 0] } },
            totalAlertsSent: { $sum: '$stats.alertsSent' },
            totalErrors: { $sum: '$stats.errorCount' },
          },
        },
      ]),
    ]);

    return {
      ok: true,
      bot: {
        configured: botInfo.ok,
        username: botInfo.result?.username,
        firstName: botInfo.result?.first_name,
      },
      connections: connectionStats[0] || {
        total: 0,
        active: 0,
        paused: 0,
        blocked: 0,
        totalAlertsSent: 0,
        totalErrors: 0,
      },
    };
  });

  /**
   * POST /api/admin/telegram-intel/bot/webhook/set
   * Set webhook URL
   */
  fastify.post('/api/admin/telegram-intel/bot/webhook/set', async (req, reply) => {
    const body = (req.body as any) || {};
    const webhookUrl = body.url;

    if (!webhookUrl) {
      return reply.status(400).send({ ok: false, error: 'url_required' });
    }

    return BotService.setWebhook(webhookUrl);
  });

  /**
   * GET /api/admin/telegram-intel/bot/connections
   * List all connections (admin)
   */
  fastify.get('/api/admin/telegram-intel/bot/connections', async (req) => {
    const q = (req.query as any) || {};
    const limit = Math.min(100, Math.max(1, Number(q.limit || 50)));
    const offset = Math.max(0, Number(q.offset || 0));
    const status = q.status;

    const filter: any = {};
    if (status) filter.status = status;

    const [items, total] = await Promise.all([
      TgBotConnectionModel.find(filter)
        .sort({ connectedAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      TgBotConnectionModel.countDocuments(filter),
    ]);

    return {
      ok: true,
      total,
      count: items.length,
      offset,
      limit,
      items: items.map((c: any) => ({
        ...c,
        _id: String(c._id),
      })),
    };
  });

  fastify.log.info('[bot] routes registered');
};
