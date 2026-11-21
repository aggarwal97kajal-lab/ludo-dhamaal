// Draw & Guess: words, guess checking and points. Shared by the app and the online server.
export const ROUNDS = 3, CHOOSE_MS = 12000, DRAW_MS = 80000, REVEAL_MS = 4500, MAX_PLAYERS = 6;
export const WORDS = [
  // Food
  'mango', 'banana', 'apple', 'samosa', 'pizza', 'burger', 'ice cream', 'cake', 'egg', 'chai', 'jalebi', 'watermelon', 'grapes', 'carrot', 'onion', 'lemon', 'coconut', 'corn', 'cookie', 'noodles', 'laddoo', 'pineapple', 'strawberry', 'cherry', 'bread',
  // Animals
  'elephant', 'tiger', 'lion', 'monkey', 'cat', 'dog', 'cow', 'fish', 'snake', 'peacock', 'parrot', 'rabbit', 'giraffe', 'camel', 'horse', 'duck', 'frog', 'butterfly', 'spider', 'turtle', 'crocodile', 'owl', 'penguin', 'zebra', 'mouse', 'ant', 'bee', 'octopus', 'whale', 'kangaroo',
  // Things
  'kite', 'umbrella', 'clock', 'phone', 'chair', 'bed', 'lamp', 'diya', 'candle', 'key', 'lock', 'book', 'pencil', 'scissors', 'glasses', 'shoe', 'hat', 'ring', 'bottle', 'cup', 'spoon', 'fan', 'tv', 'camera', 'guitar', 'drum', 'flute', 'ball', 'balloon', 'gift', 'bag', 'mirror', 'toothbrush', 'comb', 'bucket', 'ladder', 'broom', 'kettle', 'bell', 'crown', 'sword', 'anchor', 'rocket', 'robot', 'teddy bear',
  // Places and nature
  'house', 'tree', 'flower', 'sun', 'moon', 'star', 'cloud', 'rain', 'rainbow', 'mountain', 'river', 'beach', 'island', 'volcano', 'tent', 'castle', 'temple', 'bridge', 'school', 'hospital', 'taj mahal', 'desert', 'cactus', 'leaf', 'snowman', 'fire', 'lightning',
  // Travel and sport
  'car', 'bus', 'train', 'auto rickshaw', 'bicycle', 'boat', 'ship', 'aeroplane', 'helicopter', 'truck', 'tractor', 'cricket', 'football', 'bat', 'swimming', 'skipping', 'kabaddi', 'chess', 'carrom', 'ludo', 'dice',
  // People and body
  'king', 'queen', 'doctor', 'police', 'teacher', 'farmer', 'pirate', 'ghost', 'angel', 'eye', 'nose', 'hand', 'tooth', 'heart', 'brain', 'smile', 'beard', 'moustache',
  // Festivals
  'holi', 'diwali', 'rangoli', 'firecracker', 'mehndi', 'wedding', 'birthday', 'garland'
];

export const norm = t => String(t || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
// 'right', 'close' or null
export function judge(guess, word) {
  const g = norm(guess), w = norm(word);
  if (!g) return null;
  if (g === w) return 'right';
  if (w.length >= 4 && (lev(g, w) <= 1 || (g.length >= 4 && (w.startsWith(g) || g.startsWith(w))))) return 'close';
  return null;
}
// The word as blanks, with some letters shown: ['M', '_', ' ', '_']
export function hintOf(word, shown) {
  return [...word].map((ch, i) => (ch === ' ' ? ' ' : shown.includes(i) ? ch.toUpperCase() : '_'));
}
// Points: faster guesses earn more. The drawer earns for every person who guesses.
export const guessPoints = (leftMs) => 40 + Math.round(160 * Math.max(0, Math.min(1, leftMs / DRAW_MS)));
export const DRAWER_POINTS = 35;
export function pickWords(rand, n, avoid) {
  const pool = WORDS.filter(w => !(avoid || []).includes(w)), out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}
