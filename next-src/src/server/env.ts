import 'server-only';

export interface ServerEnv {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  deepseekApiKey: string;
  deepseekBaseUrl: string;
  deepseekModel: string;
  dailyQuota: number;
}

export interface XddpayEnv {
  xddpayAppId: string;
  xddpaySecret: string;
  xddpayGateway: string;
  xddpayNotifyUrl: string;
}

export type ServerEnvSource = Record<string, string | undefined>;

const PRIVATE_PUBLIC_NAMES = new Set([
  'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_DEEPSEEK_API_KEY',
  'NEXT_PUBLIC_XDDPAY_SECRET',
]);

const INVALID_CONFIGURATION = 'Invalid server configuration.';

function invalidConfiguration(): Error {
  return new Error(INVALID_CONFIGURATION);
}

function required(source: ServerEnvSource, name: string): string {
  const value = source[name]?.trim();
  if (!value) throw invalidConfiguration();
  return value;
}

function requiredHttpUrl(source: ServerEnvSource, name: string): string {
  const value = required(source, name);
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw invalidConfiguration();
    }
  } catch {
    throw invalidConfiguration();
  }
  return value;
}

function assertNoPublicSecrets(source: ServerEnvSource, privateValues: string[]): void {
  for (const [name, rawValue] of Object.entries(source)) {
    if (!name.startsWith('NEXT_PUBLIC_') || !rawValue) continue;
    const value = rawValue.trim();
    if (
      PRIVATE_PUBLIC_NAMES.has(name)
      || /(?:SERVICE_ROLE|SECRET|DEEPSEEK.*API_KEY)/.test(name)
      || privateValues.includes(value)
    ) {
      throw invalidConfiguration();
    }
  }
}

export function getServerEnv(source: ServerEnvSource = process.env): ServerEnv {
  const supabaseServiceRoleKey = required(source, 'SUPABASE_SERVICE_ROLE_KEY');
  const deepseekApiKey = required(source, 'DEEPSEEK_API_KEY');
  const optionalXddpaySecret = source.XDDPAY_SECRET?.trim();
  assertNoPublicSecrets(source, [supabaseServiceRoleKey, deepseekApiKey, optionalXddpaySecret].filter(Boolean) as string[]);

  const quotaValue = required(source, 'DAILY_QUOTA');
  if (!/^[1-9]\d*$/.test(quotaValue)) throw invalidConfiguration();
  const dailyQuota = Number(quotaValue);
  if (!Number.isSafeInteger(dailyQuota)) throw invalidConfiguration();

  return {
    supabaseUrl: requiredHttpUrl(source, 'NEXT_PUBLIC_SUPABASE_URL'),
    supabaseServiceRoleKey,
    deepseekApiKey,
    deepseekBaseUrl: requiredHttpUrl(source, 'DEEPSEEK_BASE_URL'),
    deepseekModel: required(source, 'DEEPSEEK_MODEL'),
    dailyQuota,
  };
}

export function getXddpayEnv(source: ServerEnvSource = process.env): XddpayEnv {
  const xddpaySecret = required(source, 'XDDPAY_SECRET');
  assertNoPublicSecrets(source, [xddpaySecret]);

  return {
    xddpayAppId: required(source, 'XDDPAY_APP_ID'),
    xddpaySecret,
    xddpayGateway: requiredHttpUrl(source, 'XDDPAY_GATEWAY'),
    xddpayNotifyUrl: requiredHttpUrl(source, 'XDDPAY_NOTIFY_URL'),
  };
}
