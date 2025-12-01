import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

import { QdrantClient } from '@qdrant/js-client-rest';
import { llm } from '@livekit/agents';
import nodemailer from 'nodemailer';
import psList from 'ps-list';
import type { ProcessDescriptor } from 'ps-list';
import screenshotDesktop from 'screenshot-desktop';
import si from 'systeminformation';
import { z } from 'zod';

const { tool } = llm;
const execAsync = promisify(exec);

const PLATFORM = os.platform();
const isMac = PLATFORM === 'darwin';
const isWindows = PLATFORM === 'win32';

const WEATHER_ENDPOINT = 'https://wttr.in';
const SEARCH_ENDPOINT = 'https://api.duckduckgo.com/';
const LEARNING_COLLECTION = 'gyanika_learning_history';

let cachedQdrantClient: QdrantClient | null = null;

function getQdrantClient(): QdrantClient {
  if (!cachedQdrantClient) {
    const url = process.env.QDRANT_URL ?? 'http://10.10.18.161:6333';
    cachedQdrantClient = new QdrantClient({
      url,
      apiKey: process.env.QDRANT_API_KEY ?? undefined,
    });
  }
  return cachedQdrantClient;
}

async function execCommand(command: string) {
  return execAsync(command, { timeout: 30_000, maxBuffer: 1024 * 1024 });
}

function formatError(message: string, error: unknown) {
  const reason = error instanceof Error ? error.message : 'unknown error';
  return `${message}: ${reason}`;
}

export const tools = {
  get_weather: tool({
    description: 'Get a quick summary of the current weather for a given city.',
    parameters: z.object({
      city: z.string().min(1, 'City is required').describe('City name, for example "Delhi"'),
    }),
    execute: async ({ city }) => {
      try {
        const response = await fetch(
          `${WEATHER_ENDPOINT}/${encodeURIComponent(city)}?format=3`,
        );

        if (!response.ok) {
          return `Could not retrieve weather for ${city}.`;
        }

        return (await response.text()).trim();
      } catch (error) {
        return formatError(`An error occurred while retrieving weather for ${city}`, error);
      }
    },
  }),
  search_web: tool({
    description: 'Search the public web using DuckDuckGo Instant Answer API.',
    parameters: z.object({
      query: z.string().min(1, 'Query cannot be empty').describe('Search query to look up'),
    }),
    execute: async ({ query }) => {
      try {
        const url = new URL(SEARCH_ENDPOINT);
        url.searchParams.set('q', query);
        url.searchParams.set('format', 'json');
        url.searchParams.set('no_html', '1');
        url.searchParams.set('no_redirect', '1');

        const response = await fetch(url);
        if (!response.ok) {
          return `Search failed with status ${response.status}`;
        }

        const data = (await response.json()) as {
          AbstractText?: string;
          RelatedTopics?: Array<{ Text?: string }>;
        };

        const snippets: string[] = [];
        if (data.AbstractText) {
          snippets.push(data.AbstractText);
        }

        if (Array.isArray(data.RelatedTopics)) {
          for (const topic of data.RelatedTopics) {
            if (topic.Text) {
              snippets.push(topic.Text);
            }
            if (snippets.length >= 5) {
              break;
            }
          }
        }

        if (!snippets.length) {
          return `No web results found for "${query}".`;
        }

        return `Top DuckDuckGo results for "${query}":\n- ${snippets.join('\n- ')}`;
      } catch (error) {
        return formatError(`An error occurred while searching the web for "${query}"`, error);
      }
    },
  }),
  send_email: tool({
    description: 'Send a plaintext email via Gmail SMTP with optional CC.',
    parameters: z.object({
      toEmail: z.string().email('Recipient email is invalid').describe('Primary recipient address'),
      subject: z.string().min(1, 'Subject cannot be empty'),
      message: z.string().min(1, 'Message body cannot be empty'),
      ccEmail: z.string().email().optional().describe('Optional CC recipient'),
    }),
    execute: async ({ toEmail, subject, message, ccEmail }) => {
      try {
        const gmailUser = process.env.GMAIL_USER;
        const gmailPassword = process.env.GMAIL_APP_PASSWORD;

        if (!gmailUser || !gmailPassword) {
          return 'Email sending failed: Gmail credentials not configured.';
        }

        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: gmailUser,
            pass: gmailPassword,
          },
        });

        await transporter.sendMail({
          from: gmailUser,
          to: toEmail,
          cc: ccEmail,
          subject,
          text: message,
        });

        return `Email sent successfully to ${toEmail}`;
      } catch (error) {
        return formatError('Email sending failed', error);
      }
    },
  }),
  get_system_info: tool({
    description: 'Summarize OS, CPU, memory, disk usage, and boot time for this machine.',
    execute: async () => {
      try {
        const [osInfo, cpuLoad, memInfo, fsInfo, timeInfo] = await Promise.all([
          si.osInfo(),
          si.currentLoad(),
          si.mem(),
          si.fsSize(),
          si.time(),
        ]);

        const diskUsage = fsInfo.reduce(
          (acc, disk) => {
            const usedPercent = disk.use ?? 0;
            return usedPercent > acc ? usedPercent : acc;
          },
          0,
        );

        const bootTimeSec = (timeInfo as { bootTime?: number }).bootTime;

        const lines = [
          `OS: ${osInfo.distro} ${osInfo.release} (${osInfo.platform})`,
          `Kernel: ${osInfo.kernel}`,
          `Machine: ${osInfo.hostname}`,
          `CPU Load: ${cpuLoad.currentLoad.toFixed(1)}%`,
          `Memory Usage: ${((memInfo.active / memInfo.total) * 100).toFixed(1)}%`,
          `Disk Usage (max volume): ${diskUsage.toFixed(1)}%`,
          bootTimeSec ? `Boot Time: ${new Date(bootTimeSec * 1000).toISOString()}` : undefined,
        ];

        return lines.filter(Boolean).join('\n');
      } catch (error) {
        return formatError('An error occurred while getting system information', error);
      }
    },
  }),
  open_application: tool({
    description: 'Launch a local application (e.g., browser, editor).',
    parameters: z.object({
      appName: z.string().min(1, 'Application name is required'),
    }),
    execute: async ({ appName }) => {
      try {
        if (isMac) {
          await execCommand(`open -a "${appName}"`);
        } else if (isWindows) {
          await execCommand(`start "" "${appName}"`);
        } else {
          await execCommand(`nohup "${appName}" >/dev/null 2>&1 &`);
        }

        return `Successfully opened ${appName}`;
      } catch (error) {
        return formatError(`Could not open ${appName}`, error);
      }
    },
  }),
  adjust_volume: tool({
    description: 'Set system output volume between 0-100%.',
    parameters: z.object({
      level: z.number().int().min(0).max(100).describe('Desired volume percentage'),
    }),
    execute: async ({ level }) => {
      try {
        if (isMac) {
          await execCommand(`osascript -e "set volume output volume ${level}"`);
        } else if (isWindows) {
          const nircmd = process.env.NIRCMD_PATH ?? 'nircmd.exe';
          const normalized = Math.round((level / 100) * 65_535);
          await execCommand(`"${nircmd}" setsysvolume ${normalized}`);
        } else {
          await execCommand(`amixer set Master ${level}%`);
        }

        return `Volume set to ${level}%`;
      } catch (error) {
        return formatError('Could not adjust volume', error);
      }
    },
  }),
  set_brightness: tool({
    description: 'Set screen brightness between 0-100%.',
    parameters: z.object({
      level: z.number().int().min(0).max(100).describe('Desired brightness percentage'),
    }),
    execute: async ({ level }) => {
      try {
        if (isMac) {
          await execCommand(`brightness ${level / 100}`);
        } else if (isWindows) {
          await execCommand(
            `powershell -Command "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, ${level})"`,
          );
        } else {
          try {
            await execCommand(`brightnessctl set ${level}%`);
          } catch {
            await execCommand(
              `xrandr --output eDP-1 --brightness ${(level / 100).toFixed(2)}`,
            );
          }
        }

        return `Brightness set to ${level}%`;
      } catch (error) {
        return formatError('Could not set brightness', error);
      }
    },
  }),
  take_screenshot: tool({
    description: 'Capture the current screen and save it to disk.',
    parameters: z.object({
      filename: z
        .string()
        .optional()
        .describe('Optional output path. Defaults to screenshot_<timestamp>.png in current directory'),
    }),
    execute: async ({ filename }) => {
      try {
        const targetName =
          filename ?? `screenshot_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
        const filePath = path.isAbsolute(targetName)
          ? targetName
          : path.join(process.cwd(), targetName);

        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await screenshotDesktop({ filename: filePath });

        return `Screenshot saved as ${filePath}`;
      } catch (error) {
        return formatError('Could not take screenshot', error);
      }
    },
  }),
  get_running_processes: tool({
    description: 'List the top processes by CPU usage.',
    execute: async () => {
      try {
        const processes = await psList();
        const top = processes
          .sort((a: ProcessDescriptor, b: ProcessDescriptor) => (b.cpu ?? 0) - (a.cpu ?? 0))
          .slice(0, 10)
          .map((proc: ProcessDescriptor) => {
            const memoryMb = (proc.memory ?? 0) / (1024 * 1024);
            return `${proc.name} (PID: ${proc.pid}, CPU: ${(proc.cpu ?? 0).toFixed(1)}%, Memory: ${memoryMb.toFixed(1)} MB)`;
          });

        return top.length
          ? `Top processes by CPU usage:\n${top.join('\n')}`
          : 'No running processes found.';
      } catch (error) {
        return formatError('Could not get running processes', error);
      }
    },
  }),
  create_file: tool({
    description: 'Create a file with the provided contents.',
    parameters: z.object({
      filepath: z.string().min(1, 'File path is required'),
      content: z.string().describe('Content to write'),
    }),
    execute: async ({ filepath, content }) => {
      try {
        const filePath = path.isAbsolute(filepath)
          ? filepath
          : path.join(process.cwd(), filepath);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf-8');
        return `File created successfully: ${filePath}`;
      } catch (error) {
        return formatError('Could not create file', error);
      }
    },
  }),
  read_file: tool({
    description: 'Read the contents of a file on disk.',
    parameters: z.object({
      filepath: z.string().min(1, 'File path is required'),
    }),
    execute: async ({ filepath }) => {
      try {
        const filePath = path.isAbsolute(filepath)
          ? filepath
          : path.join(process.cwd(), filepath);
        return await fs.readFile(filePath, 'utf-8');
      } catch (error) {
        return formatError('Could not read file', error);
      }
    },
  }),
  execute_command: tool({
    description:
      'Execute a shell command on the host machine (use carefully, 30 second timeout).',
    parameters: z.object({
      command: z.string().min(1, 'Command is required'),
    }),
    execute: async ({ command }) => {
      try {
        const { stdout, stderr } = await execCommand(command);
        return (stdout || stderr || 'Command executed successfully with no output').trim();
      } catch (error) {
        return formatError('Could not execute command', error);
      }
    },
  }),
  set_wifi: tool({
    description: 'Enable or disable Wi-Fi on this machine.',
    parameters: z.object({
      enable: z.boolean().describe('True to enable Wi-Fi, false to disable'),
    }),
    execute: async ({ enable }) => {
      const action = enable ? 'enable' : 'disable';
      try {
        if (isMac) {
          await execCommand(`networksetup -setairportpower en0 ${enable ? 'on' : 'off'}`);
        } else if (isWindows) {
          await execCommand(`netsh interface set interface "Wi-Fi" ${action}`);
        } else {
          await execCommand(`nmcli radio wifi ${enable ? 'on' : 'off'}`);
        }

        return `WiFi ${enable ? 'enabled' : 'disabled'} successfully`;
      } catch (error) {
        return formatError('Could not change WiFi status', error);
      }
    },
  }),
  lock_screen: tool({
    description: 'Lock the current user session.',
    execute: async () => {
      try {
        if (isMac) {
          await execCommand(
            '"/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession" -suspend',
          );
        } else if (isWindows) {
          await execCommand('rundll32.exe user32.dll,LockWorkStation');
        } else {
          await execCommand('loginctl lock-session');
        }

        return 'Screen locked successfully';
      } catch (error) {
        return formatError('Could not lock screen', error);
      }
    },
  }),
  get_my_learning_progress: tool({
    description: 'Summarize tracked learning activities for a user from Qdrant.',
    parameters: z.object({
      userId: z.string().min(1, 'User ID is required'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .default(50)
        .describe('Maximum activities to analyze (default 50)'),
    }),
    execute: async ({ userId, limit }) => {
      try {
        const client = getQdrantClient();
        const response = await client.scroll(LEARNING_COLLECTION, {
          filter: {
            must: [
              {
                key: 'user_id',
                match: {
                  value: userId,
                },
              },
            ],
          },
          limit,
          with_payload: true,
        });

        const points = response.points ?? [];
        if (points.length === 0) {
          return 'No learning activity recorded yet. Start asking questions and I will track your progress!';
        }

        const subjectCounts = new Map<string, number>();
        const activityCounts = new Map<string, number>();

        for (const point of points) {
          const payload = point.payload as Record<string, unknown>;
          const subject = (payload.subject as string) ?? 'Unknown';
          const activity = (payload.activity_type as string) ?? 'activity';

          subjectCounts.set(subject, (subjectCounts.get(subject) ?? 0) + 1);
          activityCounts.set(activity, (activityCounts.get(activity) ?? 0) + 1);
        }

        const mostActiveSubject = Array.from(subjectCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];

        const formatMap = (entries: [string, number][]) =>
          entries.map(([key, value]) => `  • ${key}: ${value}`).join('\n');

        let responseText = '📊 Your Learning Progress:\n\n';
        responseText += `Total Activities: ${points.length}\n\n`;

        if (mostActiveSubject) {
          responseText += `🎯 Most Active Subject: ${mostActiveSubject}\n\n`;
        }

        if (subjectCounts.size) {
          responseText += '📚 Subjects You\'ve Studied:\n';
          responseText += `${formatMap(Array.from(subjectCounts.entries()).sort((a, b) => b[1] - a[1]))}\n\n`;
        }

        if (activityCounts.size) {
          responseText += '🔍 Activity Breakdown:\n';
          responseText += `${formatMap(Array.from(activityCounts.entries()))}`;
        }

        return responseText.trim();
      } catch (error) {
        return formatError('Sorry, I could not retrieve your learning progress', error);
      }
    },
  }),
} satisfies llm.ToolContext;

export type ToolRegistry = typeof tools;
