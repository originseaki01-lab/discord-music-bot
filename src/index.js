import 'dotenv/config';
import express from 'express';
import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { BOT_AUTHOR, handleMusicInteraction, handlePrefixMessage, musicCommands } from './commands.js';
import { MusicManager } from './musicManager.js';

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.get('/', (_req, res) => {
  res.type('html').send('<!DOCTYPE html><html><head><title>Seaki Music Bot</title></head><body><h1>Seaki Music Bot</h1><p>Made by Seaki.</p></body></html>');
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, status: 'healthy', bot: 'Seaki Music Bot', madeBy: 'Seaki' });
});

const startServer = (candidatePort) => {
  const server = app.listen(candidatePort, () => {
    console.log(`Web server listening on port ${candidatePort}`);
  });
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      const fallbackPort = candidatePort + 1;
      console.warn(`Port ${candidatePort} is busy. Retrying on port ${fallbackPort}.`);
      startServer(fallbackPort);
      return;
    }
    throw error;
  });
};

startServer(port);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});
const musicManager = new MusicManager();
const token = process.env.DISCORD_TOKEN ?? '';
const clientId = process.env.CLIENT_ID ?? '';
const guildId = process.env.GUILD_ID ?? '';

async function registerCommands() {
  if (!token || !clientId) {
    throw new Error('DISCORD_TOKEN and CLIENT_ID are required in your .env file.');
  }
  const rest = new REST({ version: '10' }).setToken(token);
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);
  await rest.put(route, { body: musicCommands });
}

async function removeTargetMessages() {
  const targets = new Set(['hello', 'ah ke banh han']);
  for (const guild of client.guilds.cache.values()) {
    let channels;
    try {
      channels = await guild.channels.fetch();
    } catch (error) {
      console.error(`Failed to fetch channels for ${guild.name}:`, error);
      continue;
    }

    for (const channel of channels.values()) {
      if (!channel?.isTextBased() || channel.isDMBased() || !channel.messages) continue;

      let before;
      while (true) {
        let messages;
        try {
          messages = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
        } catch (error) {
          console.error(`Failed to fetch messages from ${channel.name}:`, error);
          break;
        }

        const targetMessages = messages.filter((message) => targets.has(message.content.trim().toLowerCase()));
        for (const message of targetMessages.values()) {
          try {
            await message.delete();
          } catch (error) {
            console.error(`Failed to delete bot message ${message.id} in ${channel.name}:`, error);
          }
        }

        if (messages.size < 100) break;
        const oldestMessage = messages.last();
        if (!oldestMessage) break;
        before = oldestMessage.id;
      }
    }
  }
}

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user?.tag}`);
  console.log(`Bot made by ${BOT_AUTHOR}`);
  await removeTargetMessages();
  try {
    await registerCommands();
    console.log('Slash commands registered.');
  } catch (error) {
    console.error('Failed to register slash commands:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    await handleMusicInteraction(interaction, musicManager);
  } catch (error) {
    console.error('Interaction handling failed:', error);
  }
});

client.on('messageCreate', async (message) => {
  await handlePrefixMessage(message, musicManager);
});

client.login(token).catch((error) => {
  console.error('Unable to log in to Discord:', error);
  process.exit(1);
});
