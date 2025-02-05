import { app } from 'electron';
import express from 'express';

/** @typedef {"INDEFFERENT" | "LIKE" | "DISLIKE"} LikeStatus */

/** @typedef {"NONE" | "ALL" | "ONE"} RepeatType */

/**
 * @typedef {Object} PlayerInfo
 * @property {boolean} hasSong
 * @property {boolean} isPaused
 * @property {number} volumePercent
 * @property {number} seekbarCurrentPosition
 * @property {string} seekbarCurrentPositionHuman
 * @property {number} statePercent
 * @property {LikeStatus} likeStatus
 * @property {RepeatType} repeatType
 */

/**
 * @typedef {Object} TrackInfo
 * @property {string} author
 * @property {string} title
 * @property {string} album
 * @property {string} cover
 * @property {number} duration
 * @property {string} durationHuman
 * @property {string} url
 * @property {string} id
 * @property {boolean} isVideo
 * @property {boolean} isAdvertisement
 * @property {boolean} inLibrary
 */

/**
 * @typedef {Object} Query
 * @property {PlayerInfo} player
 * @property {TrackInfo} track
 */

/**
 * @typedef {Object} Album
 * @property {string[]} alias
 * @property {number} id
 * @property {string} name
 * @property {string} picUrl
 * @property {string[]} [transNames]
 * @property {string[]} [transName]
 */

/**
 * @typedef {Object} Artist
 * @property {string[]} alias
 * @property {number} id
 * @property {string} name
 * @property {string[]} [tns]
 * @property {string[]} [trans]
 */

/**
 * @typedef {Object} PlayingSongData
 * @property {Album} album
 * @property {string[]} alias
 * @property {Artist[]} artists
 * @property {number} id
 * @property {string} name
 * @property {string[]} [transNames]
 */

/** @typedef {import("@/utils/Player.js").default} Player */

/**
 * @param {string} name
 * @param  {...string} restNames
 * @returns {string}
 */
function formatName(name, ...restNames) {
  return restNames.length === 0 ? name : `${name}（${restNames[0]}）`;
}

/**
 * @param {number} duration
 * @returns {number}
 */
function toDurationHuman(duration) {
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * @param {string} mode
 * @returns {RepeatType}
 */
function transformRepeatMode(mode) {
  return { on: 'ONE', all: 'ALL' }[mode] ?? 'NONE';
}

export function initAmuseServer() {
  const expressApp = express();

  expressApp.get('/query', async (req, res) => {
    /** @type {Player} */
    const player = await this.window.webContents.executeJavaScript(
      'window.yesplaymusic.player'
    );
    /** @type {PlayingSongData} */
    const currentTrack = player._isPersonalFM
      ? player._personalFMTrack
      : player._currentTrack;

    const { progress, currentTrackDuration } = player;

    const author = currentTrack.artists
      .map(v =>
        formatName(
          v.name,
          ...(v.tns ?? []),
          ...(v.trans ? [v.trans] : []),
          ...v.alias
        )
      )
      .join(' / ');
    const album = formatName(
      currentTrack.album.name,
      ...(currentTrack.album.transNames ?? []),
      ...(currentTrack.album.transName ?? []),
      ...currentTrack.album.alias
    );

    const title = formatName(
      currentTrack.name,
      ...(currentTrack.transNames ?? []),
      ...currentTrack.alias
    );

    /** @type {Query} */
    const response = {
      player: {
        hasSong: player.enabled,
        isPaused: !player.playing,
        volumePercent: player.volume * 100,
        seekbarCurrentPosition: progress,
        seekbarCurrentPositionHuman: toDurationHuman(progress),
        statePercent: progress / currentTrackDuration,
        likeStatus: player.isCurrentTrackLiked,
        repeatType: transformRepeatMode(player.repeatMode),
      },
      track: {
        author,
        title,
        album,
        cover: currentTrack.album.picUrl,
        duration: currentTrackDuration,
        durationHuman: toDurationHuman(currentTrackDuration),
        url: `https://music.163.com/song?id=${currentTrack.id}`,
        id: `${currentTrack.id}`,
        isVideo: false,
        isAdvertisement: false,
        inLibrary: false,
      },
    };
    res.send(response);
  });

  const port = 9863;
  const expressListen = expressApp.listen(port, () => {
    console.log(`Amuse server listening at http://localhost:${port}`);
  });

  app.on('quit', () => {
    expressListen.close();
  });
}
