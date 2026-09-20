import { AudioPlayerStatus, NoSubscriberBehavior, StreamType, createAudioPlayer, createAudioResource, joinVoiceChannel, } from '@discordjs/voice';
import { createRequire } from 'node:module';
import playdl from 'play-dl';
import ytdlp from 'youtube-dl-exec';
const require = createRequire(import.meta.url);
const ffmpegPath = require('ffmpeg-static');
if (ffmpegPath) {
    process.env.FFMPEG_PATH = ffmpegPath;
}
export class MusicManager {
    guildStates = new Map();
    getLoopMode(guildId) {
        return this.guildStates.get(guildId)?.loopMode ?? 'off';
    }
    join(guildId, channelId, member) {
        const existing = this.guildStates.get(guildId);
        if (existing && existing.channelId === channelId) {
            return `The bot is already connected to this voice channel.`;
        }
        if (existing) {
            existing.connection.destroy();
            this.guildStates.delete(guildId);
        }
        this.ensureState(guildId, channelId, member);
        return `Joined voice channel: <#${channelId}>`;
    }
    async play(guildId, channelId, member, query) {
        const state = this.ensureState(guildId, channelId, member);
        const song = await this.resolveSong(query, member.user.tag);
        if (!song) {
            return { status: 'queued', message: 'No songs were found for that search.' };
        }
        state.queue.push(song);
        if (!state.current) {
            await this.advance(guildId);
            return { status: 'playing', message: `Now playing: ${song.title}` };
        }
        return { status: 'queued', message: `Added to queue: ${song.title}` };
    }
    async skip(guildId) {
        const state = this.guildStates.get(guildId);
        if (!state) {
            return 'No music is playing in this server.';
        }
        state.player.stop();
        await this.advance(guildId);
        return 'Skipped the current track.';
    }
    pause(guildId) {
        const state = this.guildStates.get(guildId);
        if (!state) {
            return 'No music is playing in this server.';
        }
        if (state.player.state.status === AudioPlayerStatus.Paused) {
            return 'Playback is already paused.';
        }
        state.player.pause();
        return 'Paused the music.';
    }
    resume(guildId) {
        const state = this.guildStates.get(guildId);
        if (!state) {
            return 'No music is playing in this server.';
        }
        if (state.player.state.status !== AudioPlayerStatus.Paused) {
            return 'Playback is not paused.';
        }
        state.player.unpause();
        return 'Resumed the music.';
    }
    stop(guildId) {
        const state = this.guildStates.get(guildId);
        if (!state) {
            return 'No music is playing in this server.';
        }
        state.queue = [];
        state.current = undefined;
        state.previous = undefined;
        state.loopMode = 'off';
        state.player.stop();
        return 'Stopped the music and cleared the queue.';
    }
    remove(guildId, position) {
        const state = this.guildStates.get(guildId);
        if (!state) {
            return 'No music is playing in this server.';
        }
        if (position < 1 || position > state.queue.length) {
            return `Invalid queue position. Use a value from 1 to ${Math.max(state.queue.length, 1)}.`;
        }
        const [removed] = state.queue.splice(position - 1, 1);
        return removed ? `Removed from queue: ${removed.title}` : 'No track found at that position.';
    }
    clear(guildId) {
        const state = this.guildStates.get(guildId);
        if (!state) {
            return 'No music is playing in this server.';
        }
        state.queue = [];
        return 'The queue has been cleared.';
    }
    nowPlaying(guildId) {
        const state = this.guildStates.get(guildId);
        if (!state) {
            return 'No music is playing in this server.';
        }
        return state.current ? `Now playing: ${state.current.title}` : 'There is no track currently playing.';
    }
    previous(guildId) {
        return this.goToPrevious(guildId);
    }
    setLoop(guildId, mode) {
        const state = this.guildStates.get(guildId);
        if (!state) {
            return 'No music is playing in this server.';
        }
        state.loopMode = mode;
        if (mode === 'off') {
            return 'Looping is turned off.';
        }
        if (mode === 'song') {
            return 'Looping the current song.';
        }
        return 'Looping the entire queue.';
    }
    setAutoplay(guildId, enabled) {
        const state = this.guildStates.get(guildId);
        if (!state) {
            return 'No music is playing in this server.';
        }
        state.autoplay = enabled;
        return enabled ? 'Autoplay is now enabled.' : 'Autoplay is now disabled.';
    }
    shuffle(guildId) {
        const state = this.guildStates.get(guildId);
        if (!state) {
            return 'No music is playing in this server.';
        }
        if (state.queue.length < 2) {
            return 'Not enough tracks in the queue to shuffle.';
        }
        for (let i = state.queue.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
        }
        return 'The queue has been shuffled.';
    }
    getQueue(guildId) {
        const state = this.guildStates.get(guildId);
        if (!state) {
            return 'No queue in this server.';
        }
        const queueItems = state.queue.slice(0, 10);
        if (!queueItems.length && !state.current) {
            return 'The queue is empty.';
        }
        const lines = [];
        if (state.current) {
            lines.push(`Now playing: ${state.current.title}`);
        }
        if (queueItems.length) {
            lines.push('Up next:');
            queueItems.forEach((song, index) => {
                lines.push(`${index + 1}. ${song.title}`);
            });
        }
        return lines.join('\n');
    }
    getStatus(guildId) {
        const state = this.guildStates.get(guildId);
        if (!state) {
            return 'No voice session is active in this server.';
        }
        const currentText = state.current ? `Current: ${state.current.title}` : 'Current: Nothing';
        const loopText = `Loop: ${state.loopMode}`;
        const autoplayText = `Autoplay: ${state.autoplay ? 'on' : 'off'}`;
        return `${currentText}\n${loopText}\n${autoplayText}`;
    }
    ensureState(guildId, channelId, member) {
        const existing = this.guildStates.get(guildId);
        if (existing) {
            if (existing.channelId !== channelId) {
                existing.connection.destroy();
                this.guildStates.delete(guildId);
            }
            else {
                return existing;
            }
        }
        const connection = joinVoiceChannel({
            guildId,
            channelId,
            adapterCreator: member.guild.voiceAdapterCreator,
            selfDeaf: false,
        });
        const player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Pause,
            },
        });
        connection.subscribe(player);
        connection.on('stateChange', (oldState, newState) => {
            console.log(`Voice connection ${oldState.status} -> ${newState.status} in guild ${guildId}.`);
        });
        connection.on('error', (error) => {
            console.error(`Voice connection error in guild ${guildId}:`, error);
        });
        const state = {
            queue: [],
            current: undefined,
            loopMode: 'off',
            autoplay: true,
            player,
            connection,
            channelId,
        };
        player.on(AudioPlayerStatus.Idle, async () => {
            await this.advance(guildId);
        });
        player.on(AudioPlayerStatus.Playing, () => {
            console.log(`Audio player is playing in guild ${guildId}.`);
        });
        player.on('error', (error) => {
            console.error(`Audio player error in guild ${guildId}:`, error);
        });
        this.guildStates.set(guildId, state);
        return state;
    }
    async resolveSong(query, requestedBy) {
        const isUrl = /^(https?:\/\/)/i.test(query);
        if (isUrl) {
            return {
                title: 'Direct URL',
                url: query,
                duration: 'Unknown',
                requestedBy,
            };
        }
        const searchResults = await playdl.search(query, { limit: 1 });
        const matched = searchResults[0];
        if (!matched) {
            return null;
        }
        const sourceUrl = matched.url;
        return {
            title: matched.title ?? 'Unknown Title',
            url: sourceUrl,
            duration: matched.durationRaw ?? 'Unknown',
            requestedBy,
        };
    }
    async playTrack(guildId, song) {
        const state = this.guildStates.get(guildId);
        if (!state) {
            return;
        }
        try {
            const extractor = ytdlp.exec(song.url, {
                format: 'bestaudio[acodec=opus]/bestaudio',
                output: '-',
                noPlaylist: true,
                quiet: true,
                noWarnings: true,
            });
            extractor.stderr?.on('data', (chunk) => {
                const message = chunk.toString().trim();
                if (message) {
                    console.error(`Audio extractor: ${message}`);
                }
            });
            extractor.catch((error) => {
                console.error('Audio extractor failed:', error);
                if (state.current?.url === song.url) {
                    state.player.stop();
                    void this.advance(guildId);
                }
            });
            if (!extractor.stdout) {
                throw new Error(`Audio extractor did not provide a stream for ${song.title}`);
            }
            const resource = createAudioResource(extractor.stdout, {
                inputType: StreamType.WebmOpus,
                metadata: song,
            });
            state.current = song;
            state.player.play(resource);
            console.log(`Started playback: ${song.title}`);
        }
        catch (error) {
            console.error('Playback error:', error);
            await this.advance(guildId);
        }
    }
    async goToPrevious(guildId) {
        const state = this.guildStates.get(guildId);
        if (!state) {
            return 'No music is playing in this server.';
        }
        if (!state.previous) {
            return 'There is no previous track to play.';
        }
        const currentTrack = state.current;
        const previousTrack = state.previous;
        if (currentTrack) {
            state.queue.unshift(currentTrack);
        }
        state.queue.unshift(previousTrack);
        state.previous = undefined;
        state.current = undefined;
        await this.advance(guildId);
        return `Playing previous track: ${previousTrack.title}`;
    }
    async resolveAutoplay(guildId, track) {
        const state = this.guildStates.get(guildId);
        if (!state?.autoplay) {
            return null;
        }
        const fallback = await playdl.search(`${track.title} official audio`, { limit: 1 });
        const candidate = fallback[0];
        if (!candidate) {
            return null;
        }
        return {
            title: candidate.title ?? 'Autoplay Track',
            url: candidate.url,
            duration: candidate.durationRaw ?? 'Unknown',
            requestedBy: 'Autoplay',
        };
    }
    async advance(guildId) {
        const state = this.guildStates.get(guildId);
        if (!state) {
            return;
        }
        const currentTrack = state.current;
        if (state.loopMode === 'song' && currentTrack) {
            state.previous = currentTrack;
            await this.playTrack(guildId, currentTrack);
            return;
        }
        if (state.loopMode === 'queue' && currentTrack) {
            state.previous = currentTrack;
            state.queue.push(currentTrack);
        }
        else if (currentTrack) {
            state.previous = currentTrack;
        }
        state.current = undefined;
        const nextSong = state.queue.shift();
        if (!nextSong) {
            if (state.autoplay && currentTrack) {
                const autoplaySong = await this.resolveAutoplay(guildId, currentTrack);
                if (autoplaySong) {
                    state.queue.push(autoplaySong);
                    const queued = state.queue.shift();
                    if (queued) {
                        await this.playTrack(guildId, queued);
                        return;
                    }
                }
            }
            return;
        }
        await this.playTrack(guildId, nextSong);
    }
}
