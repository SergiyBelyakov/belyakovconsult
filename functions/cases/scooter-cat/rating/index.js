// Сторінка рейтингу (UA): для посилання гравця (?p=…&s=…&c=…) заголовок і опис прев'ю з його місцем.
import { rewriteShare } from '../../../../scooter-cat/server/leaderboard.js';

export const onRequestGet = ctx => rewriteShare(ctx, 'uk');
