/**
 * Actor Resolver (BLOCK 5.1)
 * Resolves user identity without hard dependency on auth system
 * Supports anonymous, telegram, email, wallet actors
 */
import { FastifyRequest } from 'fastify';
import crypto from 'crypto';

export interface Actor {
  actorId: string;
  actorType: 'anonymous' | 'telegram' | 'email' | 'wallet';
  displayName?: string;
  telegramId?: string;
  email?: string;
  wallet?: string;
}

/**
 * Resolve actor from request
 * Priority: Auth header > X-Actor header > Cookie > Anonymous
 */
export function resolveActor(req: FastifyRequest): Actor {
  // 1. Check for authenticated user (if auth system exists)
  const authUser = (req as any).user;
  if (authUser?.id) {
    return {
      actorId: String(authUser.id),
      actorType: authUser.type || 'email',
      displayName: authUser.name || authUser.email,
      email: authUser.email,
      telegramId: authUser.telegramId,
    };
  }

  // 2. Check for X-Actor header (for API clients)
  const xActor = req.headers['x-actor'] as string;
  if (xActor) {
    try {
      const parsed = JSON.parse(Buffer.from(xActor, 'base64').toString('utf-8'));
      if (parsed.actorId) {
        return {
          actorId: parsed.actorId,
          actorType: parsed.actorType || 'anonymous',
          displayName: parsed.displayName,
          telegramId: parsed.telegramId,
          email: parsed.email,
          wallet: parsed.wallet,
        };
      }
    } catch {}
  }

  // 3. Check for X-Actor-Id simple header
  const xActorId = req.headers['x-actor-id'] as string;
  const xActorType = req.headers['x-actor-type'] as string;
  if (xActorId) {
    return {
      actorId: xActorId,
      actorType: (xActorType as any) || 'anonymous',
    };
  }

  // 4. Check for anonymous cookie
  const anonCookie = (req.cookies as any)?.['tg_anon_id'];
  if (anonCookie) {
    return {
      actorId: `anon_${anonCookie}`,
      actorType: 'anonymous',
    };
  }

  // 5. Generate anonymous actor from IP + User-Agent
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${ip}::${ua}`)
    .digest('hex')
    .slice(0, 16);

  return {
    actorId: `anon_${fingerprint}`,
    actorType: 'anonymous',
  };
}

/**
 * Create actor from Telegram user data
 */
export function actorFromTelegram(telegramId: string | number, username?: string): Actor {
  return {
    actorId: `tg_${telegramId}`,
    actorType: 'telegram',
    telegramId: String(telegramId),
    displayName: username ? `@${username}` : undefined,
  };
}

/**
 * Create actor from email
 */
export function actorFromEmail(email: string, name?: string): Actor {
  const hash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 12);
  return {
    actorId: `email_${hash}`,
    actorType: 'email',
    email: email.toLowerCase(),
    displayName: name,
  };
}

/**
 * Create actor from wallet address
 */
export function actorFromWallet(wallet: string): Actor {
  return {
    actorId: `wallet_${wallet.toLowerCase().slice(0, 42)}`,
    actorType: 'wallet',
    wallet: wallet.toLowerCase(),
  };
}

/**
 * Encode actor for X-Actor header
 */
export function encodeActor(actor: Actor): string {
  return Buffer.from(JSON.stringify(actor)).toString('base64');
}
