import { config } from 'dotenv';

const ROOT_ENV_FILE = new URL('../../.env', import.meta.url);
const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

config({ path: ROOT_ENV_FILE, override: false, quiet: true });

function readTransactionsApiOrigin() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!configuredUrl) {
    throw new Error('NEXT_PUBLIC_API_URL não configurada');
  }
  let url;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error('NEXT_PUBLIC_API_URL deve ser uma origem HTTP(S) válida');
  }
  const hasOnlyOrigin = url.pathname === '/' && !url.search && !url.hash;
  const hasCredentials = Boolean(url.username || url.password);
  if (!HTTP_PROTOCOLS.has(url.protocol) || !hasOnlyOrigin || hasCredentials) {
    throw new Error('NEXT_PUBLIC_API_URL deve ser uma origem HTTP(S) sem credenciais');
  }
  return url.origin;
}

const transactionsApiOrigin = readTransactionsApiOrigin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  agentRules: false,
  experimental: {
    useTypeScriptCli: false,
  },
  env: {
    NEXT_PUBLIC_API_URL: transactionsApiOrigin,
  },
};

export default nextConfig;
