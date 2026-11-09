// Leaderboard page (EN): for a player's link (?p=…&s=…&c=…) the preview title and description show their place.
import { rewriteShare } from '../../../../../scooter-cat/server/leaderboard.js';

export const onRequestGet = ctx => rewriteShare(ctx, 'en');
