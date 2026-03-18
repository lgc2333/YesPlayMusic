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
 * @property {string[]} [alias]
 * @property {number} id
 * @property {string} name
 * @property {string} picUrl
 * @property {string[]} [transName]
 * @property {string[]} [tns]
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
 * @property {Album} [al]
 * @property {Album} [album]
 * @property {string[]} [alia]
 * @property {string[]} [alias]
 * @property {Artist[]} [artists]
 * @property {Artist[]} [ar]
 * @property {number} id
 * @property {string} name
 * @property {number} [dt]
 * @property {number} [duration]
 * @property {string[]} [tns]
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
  const transformed = { on: 'ONE', all: 'ALL' }[mode];
  return transformed ? transformed : 'NONE';
}

const emptyQuery = {
  player: {
    hasSong: false,
    isPaused: true,
    volumePercent: 0,
    seekbarCurrentPosition: 0,
    seekbarCurrentPositionHuman: '0:00',
    statePercent: 0,
    likeStatus: 'INDIFFERENT',
    repeatType: 'NONE',
  },
  track: {
    author: '',
    title: '',
    album: '',
    cover: '',
    duration: 0,
    durationHuman: '0:00',
    url: '',
    id: '',
    isVideo: false,
    isAdvertisement: false,
    inLibrary: false,
  },
};

/**
 * @param {import('@/background.js').Background} background
 */
export function initAmuseServer(background) {
  const expressApp = express();

  // disable cors
  expressApp.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept'
    );
    next();
  });

  expressApp.get('/query', async (req, res) => {
    (async () => {
      /** @type {Player} */
      const player = await background.window.webContents.executeJavaScript(
        'window.yesplaymusic.player'
      );

      /** @type {PlayingSongData} */
      const currentTrack = player._isPersonalFM
        ? player._personalFMTrack
        : player._currentTrack;

      if (Object.keys(currentTrack) <= 1) {
        res.send(emptyQuery);
        return;
      }

      const { _progress: progressRaw } = player;
      const progress = Math.floor(progressRaw);

      const durationRaw = ~~(
        (currentTrack.dt ? currentTrack.dt : currentTrack.duration) / 1000
      );
      const duration = durationRaw > 1 ? durationRaw - 1 : durationRaw;

      const author = (currentTrack.ar ? currentTrack.ar : currentTrack.artists)
        .map(v =>
          formatName(
            v.name,
            ...(v.tns ? v.tns : v.trans ? [v.trans] : []),
            ...v.alias
          )
        )
        .join(' / ');
      const alObj = currentTrack.al ? currentTrack.al : currentTrack.album;
      const album = formatName(
        alObj.name,
        ...(alObj.tns
          ? alObj.tns
          : alObj.transName === null
          ? []
          : Array.isArray(alObj.transName) // 未知 懒得测试 保险
          ? alObj.transName
          : [alObj.transName]),
        ...(alObj.alias ? alObj.alias : [])
      );

      const title = formatName(
        currentTrack.name,
        ...(currentTrack.tns
          ? currentTrack.tns
          : currentTrack.transNames
          ? currentTrack.transNames
          : []),
        ...(currentTrack.alia
          ? currentTrack.alia
          : currentTrack.alias
          ? currentTrack.alias
          : [])
      );

      /** @type {Query} */
      const response = {
        player: {
          hasSong: true,
          isPaused: !player._playing,
          volumePercent: player._volume * 100,
          seekbarCurrentPosition: progress,
          seekbarCurrentPositionHuman: toDurationHuman(progress),
          statePercent: progressRaw / durationRaw,
          likeStatus: player.isCurrentTrackLiked,
          repeatType: transformRepeatMode(player.repeatMode),
        },
        track: {
          author,
          title,
          album,
          cover: alObj.picUrl,
          duration,
          durationHuman: toDurationHuman(duration),
          url: `https://music.163.com/song?id=${currentTrack.id}`,
          id: `${currentTrack.id}`,
          isVideo: false,
          isAdvertisement: false,
          inLibrary: false,
        },
      };
      res.send(response);
    })().catch(e => {
      console.error(e);
      res.status(500).send({ error: e.message });
    });
  });

  const port = 9863;
  const expressListen = expressApp.listen(port, () => {
    console.log(`Amuse server listening at http://localhost:${port}`);
  });

  app.on('quit', () => {
    expressListen.close();
  });
}
