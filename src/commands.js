import { EmbedBuilder, GuildMember, SlashCommandBuilder } from 'discord.js';

export const BOT_AUTHOR = 'Seaki';
export const BOT_INFO_TEXT = 'Made by Seaki. Music bot by Seaki.';

export const musicCommands = [
  new SlashCommandBuilder().setName('join').setDescription('Join your current voice channel'),
  new SlashCommandBuilder().setName('play').setDescription('Play a song from YouTube or a direct URL').addStringOption((option) => option.setName('query').setDescription('Song name or URL').setRequired(true)),
  new SlashCommandBuilder().setName('skip').setDescription('Skip the current song'),
  new SlashCommandBuilder().setName('pause').setDescription('Pause playback'),
  new SlashCommandBuilder().setName('resume').setDescription('Resume playback'),
  new SlashCommandBuilder().setName('stop').setDescription('Stop playback and clear the queue'),
  new SlashCommandBuilder().setName('queue').setDescription('Show the current queue'),
  new SlashCommandBuilder().setName('loop').setDescription('Toggle loop mode').addStringOption((option) => option.setName('mode').setDescription('Choose a loop mode').setRequired(true).addChoices({ name: 'off', value: 'off' }, { name: 'song', value: 'song' }, { name: 'queue', value: 'queue' })),
  new SlashCommandBuilder().setName('autoplay').setDescription('Toggle autoplay for the current server').addStringOption((option) => option.setName('mode').setDescription('Turn autoplay on or off').setRequired(true).addChoices({ name: 'on', value: 'on' }, { name: 'off', value: 'off' })),
  new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the current queue'),
  new SlashCommandBuilder().setName('remove').setDescription('Remove a song from the queue').addIntegerOption((option) => option.setName('position').setDescription('Queue position to remove').setRequired(true)),
  new SlashCommandBuilder().setName('clear').setDescription('Clear the queue'),
  new SlashCommandBuilder().setName('nowplaying').setDescription('Show the current track'),
  new SlashCommandBuilder().setName('previous').setDescription('Play the previous track'),
  new SlashCommandBuilder().setName('status').setDescription('Show playback status'),
  new SlashCommandBuilder().setName('info').setDescription('Show bot information by Seaki'),
  new SlashCommandBuilder().setName('help').setDescription('Show a list of available bot commands'),
  new SlashCommandBuilder().setName('chatall').setDescription('Send a message to all text channels in the server').addStringOption((option) => option.setName('message').setDescription('The message to send to all channels').setRequired(true)),
].map((command) => command.toJSON());

export function buildHelpEmbed() {
  return new EmbedBuilder()
    .setAuthor({ name: 'SEAKI | MUSIC SYSTEM' })
    .setTitle('Command Center')
    .setDescription('A focused control panel for your server audio experience.\nUse slash commands for the fastest workflow, or prefix commands with `;`.')
    .addFields(
      { name: 'Playback', value: '`/join`  Join your current voice channel\n`/play <query>`  Play a song or URL\n`/skip`  Skip the current track\n`/pause`  Pause playback\n`/resume`  Continue playback\n`/stop`  Stop and clear the queue', inline: false },
      { name: 'Queue', value: '`/queue`  View the queue\n`/nowplaying`  Show the current track\n`/previous`  Return to the previous track\n`/remove <position>`  Remove a queued track\n`/clear`  Empty the queue\n`/shuffle`  Randomize the queue', inline: true },
      { name: 'Modes', value: '`/loop <mode>`  Off, song, or queue\n`/autoplay <mode>`  Enable or disable autoplay\n`/status`  View the current session', inline: true },
      { name: 'Community', value: '`/help`  Open this command center\n`/info`  About Seaki Music\n`/chatall <message>`  Broadcast to text channels', inline: false },
    )
    .setFooter({ text: 'Seaki Music | Built for uninterrupted listening' })
    .setColor(0xD4AF37);
}

export function buildInfoEmbed() {
  return new EmbedBuilder()
    .setAuthor({ name: 'SEAKI | MUSIC SYSTEM' })
    .setTitle('Seaki Music')
    .setDescription('A polished music experience for Discord communities.\nReliable playback, practical controls, and a clean command surface.')
    .addFields(
      { name: 'Created by', value: BOT_AUTHOR, inline: true },
      { name: 'Platform', value: 'Discord music bot', inline: true },
      { name: 'Designed for', value: 'Shared listening and effortless queue control', inline: false },
    )
    .setFooter({ text: 'Seaki Music | Premium playback for your server' })
    .setColor(0x00D4FF);
}

export function buildStatusEmbed(status) {
  return new EmbedBuilder().setTitle('Playback status').setDescription(status).setColor(0x5865f2);
}

export async function handlePrefixMessage(message, musicManager) {
  if (message.author.bot || !message.guild || !message.content.startsWith(';')) return;

  const [command, ...parts] = message.content.slice(1).trim().split(/\s+/);
  const args = parts.join(' ').trim();
  const member = message.member;
  if (!command || !member) return;

  if (command === 'help') {
    await message.reply({ embeds: [buildHelpEmbed()] });
    return;
  }

  if (command === 'chatall') {
    if (!args) {
      await message.reply('Usage: `;chatall <message>`');
      return;
    }
    try {
      const channels = message.guild.channels.cache.filter((ch) => ch.isTextBased() && !ch.isDMBased());
      if (channels.size === 0) {
        await message.reply('No text channels found in this server.');
        return;
      }
      let successCount = 0;
      let failCount = 0;
      for (const channel of channels.values()) {
        try {
          await channel.send(args);
          successCount++;
        } catch (error) {
          console.error(`Failed to send message to channel ${channel.name}:`, error);
          failCount++;
        }
      }
      await message.reply(`Message sent to ${successCount} channel(s). Failed: ${failCount}`);
    } catch (error) {
      console.error('Chat all prefix command failed:', error);
      await message.reply('Failed to send messages to all channels.');
    }
    return;
  }

  if (command.toLowerCase() === 'join') {
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      await message.reply('Join a voice channel before using `;join`.');
      return;
    }
    await message.reply({ content: musicManager.join(message.guild.id, voiceChannel.id, member) });
    return;
  }

  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    await message.reply('Join a voice channel before using music commands.');
    return;
  }

  try {
    switch (command.toLowerCase()) {
      case 'play': {
        if (!args) {
          await message.reply('Usage: `;play song name or URL`');
          return;
        }
        const result = await musicManager.play(message.guild.id, voiceChannel.id, member, args);
        await message.reply(result.message);
        return;
      }
      case 'skip': await message.reply(await musicManager.skip(message.guild.id)); return;
      case 'pause': await message.reply(musicManager.pause(message.guild.id)); return;
      case 'resume': await message.reply(musicManager.resume(message.guild.id)); return;
      case 'stop': await message.reply(musicManager.stop(message.guild.id)); return;
      case 'queue': await message.reply(musicManager.getQueue(message.guild.id)); return;
      case 'loop': await message.reply(musicManager.setLoop(message.guild.id, args || 'off')); return;
      case 'autoplay': await message.reply(musicManager.setAutoplay(message.guild.id, args.toLowerCase() === 'on')); return;
      case 'shuffle': await message.reply(musicManager.shuffle(message.guild.id)); return;
      case 'remove': await message.reply(musicManager.remove(message.guild.id, Number.parseInt(args, 10))); return;
      case 'clear': await message.reply(musicManager.clear(message.guild.id)); return;
      case 'nowplaying': await message.reply(musicManager.nowPlaying(message.guild.id)); return;
      case 'previous': await message.reply(await musicManager.previous(message.guild.id)); return;
      case 'status': await message.reply({ embeds: [buildStatusEmbed(musicManager.getStatus(message.guild.id))] }); return;
      case 'info': await message.reply({ embeds: [buildInfoEmbed()] }); return;
      default: return;
    }
  } catch (error) {
    console.error('Prefix command failed:', error);
    await message.reply('I could not complete that command.');
  }
}

export async function handleMusicInteraction(interaction, musicManager) {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, guildId: interactionGuildId, member } = interaction;
  if (!interactionGuildId || !(member instanceof GuildMember)) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }
  if (commandName === 'join') {
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      await interaction.reply({ content: 'Join a voice channel before using `/join`.', ephemeral: true });
      return;
    }
    await interaction.reply({ content: musicManager.join(interactionGuildId, voiceChannel.id, member) });
    return;
  }
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    await interaction.reply({ content: 'Join a voice channel before using music commands.', ephemeral: true });
    return;
  }
  switch (commandName) {
    case 'play': {
      const query = interaction.options.getString('query', true);
      await interaction.deferReply();
      try {
        const result = await musicManager.play(interactionGuildId, voiceChannel.id, member, query);
        await interaction.editReply({ content: result.message });
      } catch (error) {
        console.error('Play command failed:', error);
        await interaction.editReply({ content: 'I could not start that track. Please try another song.' });
      }
      return;
    }
    case 'skip': await interaction.reply({ content: await musicManager.skip(interactionGuildId) }); return;
    case 'pause': await interaction.reply({ content: musicManager.pause(interactionGuildId) }); return;
    case 'resume': await interaction.reply({ content: musicManager.resume(interactionGuildId) }); return;
    case 'stop': await interaction.reply({ content: musicManager.stop(interactionGuildId) }); return;
    case 'queue': await interaction.reply({ content: musicManager.getQueue(interactionGuildId) }); return;
    case 'loop': await interaction.reply({ content: musicManager.setLoop(interactionGuildId, interaction.options.getString('mode', true)) }); return;
    case 'autoplay': await interaction.reply({ content: musicManager.setAutoplay(interactionGuildId, interaction.options.getString('mode', true) === 'on') }); return;
    case 'shuffle': await interaction.reply({ content: musicManager.shuffle(interactionGuildId) }); return;
    case 'remove': await interaction.reply({ content: musicManager.remove(interactionGuildId, interaction.options.getInteger('position', true)) }); return;
    case 'clear': await interaction.reply({ content: musicManager.clear(interactionGuildId) }); return;
    case 'nowplaying': await interaction.reply({ content: musicManager.nowPlaying(interactionGuildId) }); return;
    case 'previous': await interaction.reply({ content: await musicManager.previous(interactionGuildId) }); return;
    case 'status': await interaction.reply({ embeds: [buildStatusEmbed(musicManager.getStatus(interactionGuildId))] }); return;
    case 'info': await interaction.reply({ embeds: [buildInfoEmbed()] }); return;
    case 'help': await interaction.reply({ embeds: [buildHelpEmbed()] }); return;
    case 'chatall': {
      const message = interaction.options.getString('message', true);
      await interaction.deferReply();
      try {
        const channels = interaction.guild?.channels.cache.filter((ch) => ch.isTextBased() && !ch.isDMBased());
        if (!channels || channels.size === 0) {
          await interaction.editReply({ content: 'No text channels found in this server.' });
          return;
        }
        let successCount = 0;
        let failCount = 0;
        for (const channel of channels.values()) {
          try {
            await channel.send(message);
            successCount++;
          } catch (error) {
            console.error(`Failed to send message to channel ${channel.name}:`, error);
            failCount++;
          }
        }
        await interaction.editReply({ content: `Message sent to ${successCount} channel(s). Failed: ${failCount}` });
      } catch (error) {
        console.error('Chat all command failed:', error);
        await interaction.editReply({ content: 'Failed to send messages to all channels.' });
      }
      return;
    }
    default: await interaction.reply({ content: 'Unknown command.' });
  }
}
