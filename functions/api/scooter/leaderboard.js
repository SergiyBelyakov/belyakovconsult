// Рейтинг гри «Котик на самокаті»: таблиця (GET) і надсилання результату (POST). Логіка в scooter-cat/server/leaderboard.js.
import { getBoard, submitScore } from '../../../scooter-cat/server/leaderboard.js';

export const onRequestGet = ({ request, env }) => getBoard(request, env);
export const onRequestPost = ({ request, env }) => submitScore(request, env);
