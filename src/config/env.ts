import { z } from 'zod';

const PROFILES = ['triage', 'agent', 'knowledge', 'full'] as const;
const TRANSPORTS = ['stdio', 'http'] as const;

const csv = (raw: string | undefined): string[] =>
  raw
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

const EnvSchema = z.object({
  SWSD_TOKEN: z.string().optional(),
  SWSD_BASE_URL: z
    .string()
    .url()
    .default('https://api.samanage.com'),
  SWSD_API_VERSION: z.string().min(1).default('v2.1'),
  SWSD_TRANSPORT: z.enum(TRANSPORTS).default('stdio'),
  SWSD_PROFILE: z.enum(PROFILES).default('agent'),
  SWSD_ENABLE_EXTRAS: z
    .string()
    .optional()
    .transform(csv),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  SWSD_ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform(csv),
  SWSD_RETRY_MAX_ATTEMPTS: z.coerce.number().int().min(0).max(10).default(3),
});

export type Env = z.infer<typeof EnvSchema>;
export type ProfileName = (typeof PROFILES)[number];
export type TransportName = (typeof TRANSPORTS)[number];
export const KNOWN_PROFILES = PROFILES;
export const KNOWN_TRANSPORTS = TRANSPORTS;

export function parseEnv(raw: NodeJS.ProcessEnv): Env {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    process.stderr.write('Invalid environment configuration:\n');
    for (const issue of result.error.issues) {
      process.stderr.write(`  ${issue.path.join('.') || '(root)'}: ${issue.message}\n`);
    }
    process.exit(2);
  }
  return result.data;
}
