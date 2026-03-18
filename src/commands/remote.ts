import chalk from "chalk";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { createServer } from "node:http";
import { exec } from "node:child_process";
import { hostname } from "node:os";
import { DOCTOR_HOME } from "../config.js";

// Proxy-aware fetch: reads HTTPS_PROXY / https_proxy / ALL_PROXY from env
async function proxyFetch(url: string, init?: RequestInit): Promise<Response> {
  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy;
  if (proxyUrl) {
    try {
      // undici is bundled with Node 18+
      const { ProxyAgent, fetch: undiciFetch } = await import("undici") as any;
      const dispatcher = new ProxyAgent(proxyUrl);
      return undiciFetch(url, { ...init, dispatcher }) as Promise<Response>;
    } catch {
      // fallback to global fetch if undici unavailable
    }
  }
  return fetch(url, init);
}

const REMOTE_API_URL = "https://api.openclaw-cli.app";
const REMOTE_CONFIG_FILE = join(DOCTOR_HOME, "remote.json");

interface RemoteConfig {
  enabled: boolean;
  machineId: string;
  machineToken: string;
  reportUrl: string;
  lastReport: string | null;
}

function loadRemoteConfig(): RemoteConfig {
  try {
    if (existsSync(REMOTE_CONFIG_FILE)) {
      return JSON.parse(readFileSync(REMOTE_CONFIG_FILE, "utf-8"));
    }
  } catch {}
  return {
    enabled: false,
    machineId: randomUUID(),
    machineToken: "",
    reportUrl: REMOTE_API_URL + "/v1/report",
    lastReport: null,
  };
}

function saveRemoteConfig(config: RemoteConfig): void {
  const dir = join(REMOTE_CONFIG_FILE, "..");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(REMOTE_CONFIG_FILE, JSON.stringify(config, null, 2));
}

const OAUTH_CLIENT_ID =
  "PLACEHOLDER_CLIENT_ID";
const OAUTH_REDIRECT_URI = "http://localhost:9876/callback";
const OAUTH_AUTH_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const OAUTH_SCOPE = "openid email profile";
const OAUTH_TIMEOUT_MS = 60_000;

function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd);
}

function waitForOAuthCallback(
  codeVerifier: string,
): Promise<{ idToken: string; email: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      if (!req.url?.startsWith("/callback")) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const url = new URL(req.url, "http://localhost:9876");
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error || !code) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          "<html><body style='text-align:center;padding:40px;font-family:system-ui'>" +
            "<h2 style='color:#e53e3e'>Login failed</h2>" +
            `<p>${error || "No authorization code received."}</p>` +
            "</body></html>",
        );
        clearTimeout(timeout);
        server.close();
        reject(new Error(error || "No authorization code received"));
        return;
      }

      // Exchange code for tokens
      try {
        const tokenRes = await proxyFetch(OAUTH_TOKEN_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: OAUTH_CLIENT_ID,
            redirect_uri: OAUTH_REDIRECT_URI,
            grant_type: "authorization_code",
            code_verifier: codeVerifier,
            client_secret: "PLACEHOLDER_OCS",
          }).toString(),
        });

        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          throw new Error(`Token exchange failed: ${tokenRes.status} ${errText}`);
        }

        const tokenData = (await tokenRes.json()) as {
          id_token: string;
          access_token: string;
        };

        // Decode email from id_token (JWT payload)
        const payload = JSON.parse(
          Buffer.from(tokenData.id_token.split(".")[1], "base64url").toString(),
        ) as { email: string };

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          "<html><head><meta charset='utf-8'></head><body style='text-align:center;padding:40px;font-family:system-ui;background:#0d0f14;color:#e2e8f0'>" +
            "<h2 style='color:#38a169'>&#10003; Logged in! This tab will close in <span id='c'>5</span>s...</h2>" +
            "<script>var n=5;var t=setInterval(function(){n--;document.getElementById('c').textContent=n;if(n<=0){clearInterval(t);window.close();}},1000);</script>" +
            "</body></html>",
        );

        clearTimeout(timeout);
        server.close();
        resolve({ idToken: tokenData.id_token, email: payload.email });
      } catch (err) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          "<html><body style='text-align:center;padding:40px;font-family:system-ui'>" +
            "<h2 style='color:#e53e3e'>Login failed</h2>" +
            `<p>${String(err)}</p>` +
            "</body></html>",
        );
        clearTimeout(timeout);
        server.close();
        reject(err);
      }
    });

    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Login timed out — no callback received within 60 seconds"));
    }, OAUTH_TIMEOUT_MS);

    server.listen(9876, "127.0.0.1");
  });
}

export async function remoteLogin(_options: {
  config?: string;
  profile?: string;
}) {
  const config = loadRemoteConfig();

  console.log(chalk.cyan.bold("\n  Remote Monitoring Login\n"));
  console.log(chalk.gray("  Opening browser for Google sign-in...\n"));

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const authUrl =
    OAUTH_AUTH_ENDPOINT +
    "?" +
    new URLSearchParams({
      client_id: OAUTH_CLIENT_ID,
      redirect_uri: OAUTH_REDIRECT_URI,
      response_type: "code",
      scope: OAUTH_SCOPE,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      access_type: "offline",
    }).toString();

  openBrowser(authUrl);

  let idToken: string;
  let email: string;
  try {
    const result = await waitForOAuthCallback(codeVerifier);
    idToken = result.idToken;
    email = result.email;
  } catch (err) {
    console.log(chalk.red(`  ${String(err)}`));
    return;
  }

  console.log(chalk.gray("  Registering this machine..."));

  try {
    const host = hostname();
    const os = process.platform + "/" + process.arch;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await proxyFetch(REMOTE_API_URL + "/v1/machines/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + idToken,
      },
      body: JSON.stringify({ hostname: host, os, version: "unknown" }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const err = await res.text();
      console.log(chalk.red(`  Registration failed: ${res.status} ${err}`));
      return;
    }

    const data = (await res.json()) as {
      machineId: string;
      machineToken: string;
    };

    config.machineId = data.machineId;
    config.machineToken = data.machineToken;
    config.enabled = true;
    config.reportUrl = REMOTE_API_URL + "/v1/report";
    saveRemoteConfig(config);

    console.log(chalk.green.bold(`\n  Logged in as ${email}`));
    console.log(chalk.gray(`  Machine registered: ${host}`));
    console.log(
      chalk.gray("  Remote monitoring ready. Run: openclaw-cli remote enable\n"),
    );
  } catch (err) {
    console.log(chalk.red(`  Error: ${err}`));
  }
}

export async function remoteEnable(_options: {
  config?: string;
  profile?: string;
}) {
  const config = loadRemoteConfig();
  if (!config.machineToken) {
    console.log(
      chalk.red("  ✗ Not logged in. Run: openclaw-cli remote login"),
    );
    return;
  }
  config.enabled = true;
  saveRemoteConfig(config);
  console.log(chalk.green("  Remote reporting enabled."));
}

export async function remoteDisable(_options: {
  config?: string;
  profile?: string;
}) {
  const config = loadRemoteConfig();
  config.enabled = false;
  saveRemoteConfig(config);
  console.log(chalk.yellow("  Remote reporting disabled."));
}

export async function remoteStatus(_options: {
  config?: string;
  profile?: string;
}) {
  const config = loadRemoteConfig();

  console.log(chalk.cyan.bold("\n  Remote Monitoring Status\n"));
  console.log(
    `  Enabled:       ${config.enabled ? chalk.green("yes") : chalk.gray("no")}`,
  );
  console.log(
    `  Machine ID:    ${chalk.white(config.machineId || "(none)")}`,
  );
  console.log(
    `  Token:         ${config.machineToken ? chalk.green("configured") : chalk.red("not set")}`,
  );
  console.log(
    `  Report URL:    ${chalk.gray(config.reportUrl)}`,
  );
  console.log(
    `  Last Report:   ${config.lastReport ? chalk.gray(config.lastReport) : chalk.gray("never")}`,
  );
  console.log();
}
