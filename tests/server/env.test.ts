import { describe, expect, it } from 'vitest';
import { DEFAULT_GEMINI_MODEL, parseServerEnv } from '@/src/server/env';

describe('parseServerEnv', () => {
  it('runs with nothing set: memory data, no AI, local secret', () => {
    expect(parseServerEnv({})).toEqual({
      nodeEnv: 'development',
      mongoUri: null,
      mongoDb: 'fairshift',
      dataBackend: 'memory',
      sessionSecret: null,
      geminiApiKey: null,
      geminiModel: DEFAULT_GEMINI_MODEL,
    });
  });

  it('treats blank lines copied from .env.example as unset', () => {
    const env = parseServerEnv({ MONGODB_URI: '', GEMINI_API_KEY: '  ', DATA_BACKEND: '' });
    expect(env.mongoUri).toBeNull();
    expect(env.geminiApiKey).toBeNull();
    expect(env.dataBackend).toBe('memory');
  });

  it('selects MongoDB when a URI is set, unless memory is forced', () => {
    const uri = 'mongodb+srv://user:pw@cluster.example.net';
    expect(parseServerEnv({ MONGODB_URI: uri }).dataBackend).toBe('mongodb');
    expect(parseServerEnv({ MONGODB_URI: uri, DATA_BACKEND: 'memory' }).dataBackend).toBe('memory');
  });

  it('names every malformed variable in one error, without echoing values', () => {
    let message = '';
    try {
      parseServerEnv({ MONGODB_URI: 'postgres://nope', SESSION_SECRET: 'short' });
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain('MONGODB_URI');
    expect(message).toContain('SESSION_SECRET');
    expect(message).not.toContain('postgres://nope');
  });

  it('parses a production env without SESSION_SECRET, so `next build` needs no secrets', () => {
    expect(parseServerEnv({ NODE_ENV: 'production' }).sessionSecret).toBeNull();
    const env = parseServerEnv({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32) });
    expect(env.sessionSecret).toHaveLength(32);
  });

  it('rejects a model id with path or URL characters', () => {
    expect(() => parseServerEnv({ GEMINI_MODEL: 'gemini/../../x' })).toThrow(/GEMINI_MODEL/);
  });
});
