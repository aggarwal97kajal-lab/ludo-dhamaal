// App language: English (default), Hinglish or Hindi.
// The screens are written in English; this swaps known phrases on screen as they appear.
// [English, Hinglish, Hindi]
const T = [
  ['Who do you want to play with?', 'Kiske saath khelna hai?', 'किसके साथ खेलना है?'], ['All games', 'Sab games', 'सभी खेल'], ['Welcome back 👋', 'Wapas swagat hai 👋', 'फिर से स्वागत है 👋'],
  ['Play solo against the computer', 'Akele computer se khelo', 'अकेले कंप्यूटर से खेलो'], ['Play a friend anywhere and talk on mic', 'Dost ke saath kahin se bhi khelo', 'दोस्त के साथ कहीं से भी खेलो'],
  ['2 players taking turns on one phone', '2 log ek phone pe baari-baari', '2 लोग एक फ़ोन पर बारी-बारी'], ['Your turn: tap a box', 'Aapki baari: dabba chuno', 'आपकी बारी: खाना चुनो'], ['Next round starting...', 'Agla round shuru...', 'अगला राउंड शुरू...'],
  ['👆 Hold, drag to aim, let go', '👆 Dabake rakho, nishana lagao, chhodo', '👆 दबाकर रखो, निशाना लगाओ, छोड़ो'], ['Let go to shoot!', 'Ab chhodo!', 'अब छोड़ो!'], ['Steady', 'Sthir', 'स्थिर'],
  ['BULLSEYE!', 'BULLSEYE!', 'बुल्सआई!'], ['Great shot!', 'Zabardast!', 'ज़बरदस्त!'], ['Miss', 'Chook gaya', 'चूक गया'], ['Crop your photo', 'Photo crop karo', 'फ़ोटो काटो'], ['Use photo ✓', 'Lagao ✓', 'लगाओ ✓'],
  ['Free', 'Free', 'खुला'], ['Square', 'Square', 'चौकोर'], ['Rotate', 'Ghumao', 'घुमाओ'], ['Flip', 'Ulta', 'उल्टा'], ['Preview', 'Aisa dikhega', 'ऐसा दिखेगा'], ['Reset', 'Reset', 'रीसेट'],
  ['Next ▸', 'Aage ▸', 'आगे ▸'], ['Skip', 'Skip', 'छोड़ो'], ['Let’s go ▸', 'Chalo ▸', 'चलो ▸'], ['App tour', 'App ki sair', 'ऐप की सैर'], ['Zero Kanta', 'Zero Kanta', 'ज़ीरो काटा'], ['Archery', 'Archery', 'तीरंदाज़ी'],
  ['Pick a game here 🎲', 'Yahan se game chuno 🎲', 'यहाँ से खेल चुनो 🎲'], ['Free reward every day 🎁', 'Roz free inaam 🎁', 'रोज़ मुफ़्त इनाम 🎁'], ['Play with friends 👥', 'Doston ke saath khelo 👥', 'दोस्तों के साथ खेलो 👥'],
  ['Games', 'Games', 'गेम्स'], ['History', 'History', 'इतिहास'], ['Friends', 'Dost', 'दोस्त'], ['Profile', 'Profile', 'प्रोफ़ाइल'],
  ['Welcome back', 'Wapas swagat hai', 'फिर से स्वागत है'], ['Family game night, every night', 'Har raat family game night', 'हर रात परिवार के साथ खेल'],
  ['Daily', 'Daily', 'रोज़ाना'], ['Shop', 'Dukaan', 'दुकान'], ['Badges', 'Badges', 'बैज'],
  ['Ludo', 'Ludo', 'लूडो'], ['Chess', 'Chess', 'शतरंज'], ['Carrom', 'Carrom', 'कैरम'], ['Snakes & Ladders', 'Saanp Seedhi', 'साँप सीढ़ी'], ['Sudoku', 'Sudoku', 'सुडोकू'],
  ['Arrow Escape', 'Arrow Escape', 'तीर निकालो'], ['Draw & Guess', 'Draw & Guess', 'चित्र बनाओ, पहचानो'], ['Helix Drop', 'Helix Drop', 'हेलिक्स ड्रॉप'],
  ['Walk your team home', 'Apni team ko ghar pahunchao', 'अपनी टीम को घर पहुँचाओ'], ['With move help', 'Chaal ki madad ke saath', 'चाल की मदद के साथ'], ['3 ways to play', 'Khelne ke 3 tareeke', 'खेलने के 3 तरीके'],
  ['First to 100', '100 pe pehle pahuncho', 'पहले 100 पर पहुँचो'], ['Colour & number', 'Rang aur number', 'रंग और नंबर'], ['Daily puzzle', 'Aaj ki paheli', 'आज की पहेली'],
  ['Draw, friends guess', 'Tum banao, dost pehchanein', 'तुम बनाओ, दोस्त पहचानें'],
  ['Create online room', 'Online room banao', 'ऑनलाइन रूम बनाओ'], ['Join a room', 'Room join karo', 'रूम में जुड़ो'], ['Play vs computer', 'Computer se khelo', 'कंप्यूटर से खेलो'], ['Pass & play', 'Ek phone, sab khelo', 'एक फ़ोन, सब खेलो'],
  ['Invite friends anywhere and talk on mic', 'Kahin bhi doston ko bulao, mic pe baat karo', 'कहीं भी दोस्तों को बुलाओ, माइक पर बात करो'],
  ['Enter your friend’s room code', 'Dost ka room code daalo', 'दोस्त का रूम कोड डालो'], ['Play solo against a bot', 'Akele computer se khelo', 'अकेले कंप्यूटर से खेलो'],
  ['Play a friend anywhere and talk on mic', 'Dost ke saath kahin se bhi khelo', 'दोस्त के साथ कहीं से भी खेलो'], ['Play solo against the computer', 'Akele computer se khelo', 'अकेले कंप्यूटर से खेलो'],
  ['Create a room', 'Room banao', 'रूम बनाओ'], ['Invite friends on WhatsApp', 'WhatsApp pe doston ko bulao', 'व्हाट्सऐप पर दोस्तों को बुलाओ'], ['Race a friend', 'Dost se race', 'दोस्त से रेस'], ['Join a race', 'Race join karo', 'रेस में जुड़ो'],
  ['Classic', 'Classic', 'क्लासिक'], ['All 4 tokens home to win', 'Chaaron goti ghar pahunchao', 'चारों गोटी घर पहुँचाओ'],
  ['Quick Ludo', 'Quick Ludo', 'क्विक लूडो'], ['2 tokens each, already out. Short games', '2-2 goti, pehle se bahar. Chhote game', '2-2 गोटी, पहले से बाहर। छोटे गेम'],
  ['Timer Ludo', 'Timer Ludo', 'टाइमर लूडो'], ['10 minutes. Points for steps and captures', '10 minute. Har kadam aur maar pe points', '10 मिनट। हर कदम और मार पर पॉइंट'],
  ['2 vs 2 Team', '2 vs 2 Team', '2 बनाम 2 टीम'], ['Partner sits opposite. 4 players, win together', 'Saathi saamne baithta hai. Saath jeeto', 'साथी सामने बैठता है। साथ जीतो'],
  ['Computer level', 'Computer ka level', 'कंप्यूटर का स्तर'], ['Easy', 'Aasaan', 'आसान'], ['Medium', 'Medium', 'मध्यम'], ['Hard', 'Mushkil', 'कठिन'],
  ['How many players?', 'Kitne khiladi?', 'कितने खिलाड़ी?'], ['Start game', 'Game shuru karo', 'खेल शुरू करो'], ['Play again', 'Phir se khelo', 'फिर से खेलो'], ['Back to home', 'Home pe wapas', 'होम पर वापस'],
  ['You won!', 'Aap jeet gaye!', 'आप जीत गए!'], ['Your team won!', 'Aapki team jeet gayi!', 'आपकी टीम जीत गई!'], ['Good game! Try again?', 'Accha khela! Phir se?', 'अच्छा खेला! फिर से?'],
  ['Your turn', 'Aapki baari', 'आपकी बारी'], ['Roll again!', 'Phir se chalo!', 'फिर से चलो!'], ['No move', 'Koi chaal nahi', 'कोई चाल नहीं'], ['Time up, turn skipped', 'Time khatam, baari gayi', 'समय खत्म, बारी गई'],
  ['Time up!', 'Time khatam!', 'समय खत्म!'], ['Vs computer', 'Computer se', 'कंप्यूटर से'], ['Finished!', 'Pahunch gaye!', 'पहुँच गए!'], ['At start', 'Shuru mein', 'शुरू में'],
  ['Your room', 'Aapka room', 'आपका रूम'], ['Room code', 'Room code', 'रूम कोड'], ['Share on WhatsApp', 'WhatsApp pe bhejo', 'व्हाट्सऐप पर भेजो'], ['Players', 'Khiladi', 'खिलाड़ी'],
  ['Empty slot', 'Khaali jagah', 'खाली जगह'], ['Waiting for a friend...', 'Dost ka intezaar...', 'दोस्त का इंतज़ार...'], ['Waiting for host...', 'Host ka intezaar...', 'होस्ट का इंतज़ार...'], ['Host', 'Host', 'होस्ट'], ['Ready', 'Taiyaar', 'तैयार'],
  ['Waiting for network...', 'Network ka intezaar...', 'नेटवर्क का इंतज़ार...'], ['Online', 'Online', 'ऑनलाइन'], ['Offline', 'Offline', 'ऑफ़लाइन'], ['Reconnecting...', 'Phir jud rahe hain...', 'फिर जुड़ रहे हैं...'],
  ['Leave the room?', 'Room chhodna hai?', 'रूम छोड़ना है?'], ['Leave the game?', 'Game chhodna hai?', 'खेल छोड़ना है?'], ['Leave', 'Chhodo', 'छोड़ो'], ['Stay', 'Ruko', 'रुको'], ['Cancel', 'Rehne do', 'रद्द करो'],
  ['OK', 'Theek hai', 'ठीक है'], ['Done', 'Ho gaya', 'हो गया'], ['Close', 'Band karo', 'बंद करो'], ['Save', 'Save karo', 'सहेजो'], ['Later', 'Baad mein', 'बाद में'], ['Not now', 'Abhi nahi', 'अभी नहीं'], ['Join', 'Join', 'जुड़ो'], ['Invite', 'Bulao', 'बुलाओ'],
  ['Chat', 'Chat', 'चैट'], ['Type a message', 'Message likho', 'संदेश लिखो'], ['Say hi to your friends!', 'Doston ko hi bolo!', 'दोस्तों को नमस्ते बोलो!'],
  ['Match History', 'Match History', 'मैच इतिहास'], ['Recent', 'Haal ke', 'हाल के'], ['Your games', 'Aapke games', 'आपके खेल'], ['Last 7 days', 'Pichhle 7 din', 'पिछले 7 दिन'], ['Played', 'Khele', 'खेले'], ['Won', 'Jeete', 'जीते'], ['Lost', 'Haare', 'हारे'],
  ['Best time', 'Sabse tez', 'सबसे तेज़'], ['Average', 'Ausat', 'औसत'], ['Show more', 'Aur dikhao', 'और दिखाओ'], ['Today', 'Aaj', 'आज'], ['Yesterday', 'Kal', 'कल'], ['All', 'Sab', 'सब'],
  ['Daily reward', 'Roz ka inaam', 'रोज़ का इनाम'], ['7-day login streak', '7 din ka streak', '7 दिन का सिलसिला'], ['Spin for free', 'Free mein ghumao', 'मुफ़्त में घुमाओ'], ['Come back tomorrow for a new spin', 'Kal phir ghumana', 'कल फिर घुमाना'],
  ['Coins are only for fun items in the shop. No real money.', 'Coins sirf dukaan ki mazedaar cheezon ke liye. Asli paisa nahi.', 'सिक्के सिर्फ़ दुकान की चीज़ों के लिए हैं। असली पैसा नहीं।'],
  ['Frames', 'Frame', 'फ़्रेम'], ['Dice', 'Paasa', 'पासा'], ['Strikers', 'Striker', 'स्ट्राइकर'], ['Boards', 'Board', 'बोर्ड'], ['Owned · tap to use', 'Aapka hai · lagao', 'आपका है · लगाओ'], ['Using', 'Laga hai', 'लगा है'],
  ['Win games and spin the daily wheel to earn coins.', 'Game jeeto aur wheel ghumao, coins kamao.', 'खेल जीतो और पहिया घुमाओ, सिक्के कमाओ।'], ['Not enough coins', 'Coins kam hain', 'सिक्के कम हैं'],
  ['Share my win', 'Meri jeet share karo', 'मेरी जीत शेयर करो'], ['Share your win', 'Apni jeet share karo', 'अपनी जीत शेयर करो'], ['More', 'Aur', 'और'],
  ['First win', 'Pehli jeet', 'पहली जीत'], ['Win any game', 'Koi bhi game jeeto', 'कोई भी खेल जीतो'], ['On fire', 'Aag laga di', 'धमाकेदार'], ['5 wins in a row', 'Lagatar 5 jeet', 'लगातार 5 जीत'],
  ['Your friend code', 'Aapka friend code', 'आपका फ़्रेंड कोड'], ['Share my code on WhatsApp', 'WhatsApp pe code bhejo', 'व्हाट्सऐप पर कोड भेजो'], ['This week', 'Is hafte', 'इस हफ़्ते'], ['+ Add', '+ Jodo', '+ जोड़ो'],
  ['Add a friend', 'Dost jodo', 'दोस्त जोड़ो'], ['Add friend', 'Dost jodo', 'दोस्त जोड़ो'], ['No friends yet', 'Abhi koi dost nahi', 'अभी कोई दोस्त नहीं'], ['Invite friends', 'Doston ko bulao', 'दोस्तों को बुलाओ'], ['In Pitara home', 'Pitara home pe', 'पिटारा होम पर'],
  ['Invite sent', 'Bulawa bhej diya', 'बुलावा भेज दिया'], ['Open Friends', 'Dost kholo', 'दोस्त खोलो'],
  ['Wins this week with friends · starts again on Monday', 'Is hafte doston ke saath jeet · Somvaar ko naya', 'इस हफ़्ते दोस्तों के साथ जीत · सोमवार को नया'],
  ['Sound & Vibration', 'Awaaz aur vibration', 'आवाज़ और कंपन'], ['How to play', 'Kaise khelein', 'कैसे खेलें'], ['My profile and photo', 'Meri profile aur photo', 'मेरी प्रोफ़ाइल और फ़ोटो'], ['Language', 'Bhasha', 'भाषा'],
  ['My Profile', 'Meri Profile', 'मेरी प्रोफ़ाइल'], ['Your name', 'Aapka naam', 'आपका नाम'], ['Save profile', 'Profile save karo', 'प्रोफ़ाइल सहेजो'], ['Profile photo', 'Profile photo', 'प्रोफ़ाइल फ़ोटो'], ['Camera', 'Camera', 'कैमरा'], ['Gallery', 'Gallery', 'गैलरी'],
  ['Pocket your colour and cover the Queen', 'Apne rang ki goti daalo, Queen cover karo', 'अपने रंग की गोटी डालो, रानी कवर करो'], ['Free Style', 'Free Style', 'फ़्री स्टाइल'], ['Disc Pool', 'Disc Pool', 'डिस्क पूल'], ['Striker', 'Striker', 'स्ट्राइकर'],
  ['You are watching', 'Aap dekh rahe hain', 'आप देख रहे हैं'], ['Play next game', 'Agla game khelo', 'अगला खेल खेलो'], ['Watching', 'Dekh rahe', 'देख रहे'], ['Watch live', 'Live dekho', 'लाइव देखो'],
  ['Room settings', 'Room settings', 'रूम सेटिंग'], ['Allow viewers', 'Dekhne waale aa sakein', 'देखने वाले आ सकें'], ['Viewers can talk', 'Dekhne waale bol sakein', 'देखने वाले बोल सकें'], ['Computer plays for leavers', 'Chhodne waale ki jagah computer', 'छोड़ने वाले की जगह कंप्यूटर'],
  ['Mate in 1', 'Ek chaal mein maat', 'एक चाल में मात'], ['Mate in 2', 'Do chaal mein maat', 'दो चाल में मात'], ['Puzzle solved!', 'Paheli hal!', 'पहेली हल!'], ['Not this one. Try again!', 'Ye nahi. Phir try karo!', 'यह नहीं। फिर कोशिश करो!'],
  ['Check! Your turn', 'Shah! Aapki baari', 'शह! आपकी बारी'], ['Game over', 'Khel khatam', 'खेल खत्म'], ['Next level', 'Agla level', 'अगला स्तर'], ['Try again', 'Phir try karo', 'फिर कोशिश करो'], ['Back', 'Wapas', 'वापस'],
  ['Making your win card...', 'Jeet ka card ban raha hai...', 'जीत का कार्ड बन रहा है...'], ['Player left the game', 'Khiladi game chhod gaya', 'खिलाड़ी खेल छोड़ गया'], ['Muted for you', 'Aapke liye mute', 'आपके लिए म्यूट'], ['Unmuted', 'Awaaz chalu', 'आवाज़ चालू'],
  ['Code copied', 'Code copy ho gaya', 'कोड कॉपी हो गया'], ['No internet. Try again.', 'Internet nahi hai. Phir try karo.', 'इंटरनेट नहीं है। फिर कोशिश करो।'], ['Profile saved', 'Profile save ho gayi', 'प्रोफ़ाइल सहेजी गई'],
  ['Undo', 'Wapas', 'वापस'], ['Erase', 'Mitao', 'मिटाओ'], ['Notes', 'Notes', 'नोट्स'], ['Hint', 'Hint', 'संकेत'], ['Mistakes', 'Galtiyan', 'गलतियाँ'], ['Restart', 'Dobara', 'दोबारा'], ['New game', 'Naya game', 'नया खेल'],
  ['Type your guess', 'Apna guess likho', 'अपना अंदाज़ा लिखो'], ['Pick a word to draw', 'Banane ke liye shabd chuno', 'बनाने के लिए शब्द चुनो'], ['Nobody guessed it', 'Kisi ne nahi pehchana', 'किसी ने नहीं पहचाना']
];
const RULES = [
  [/^Players \((\d+)\/(\d+)\)$/, ['Khiladi ($1/$2)', 'खिलाड़ी ($1/$2)']],
  [/^Home (\d+)\/(\d+)$/, ['Ghar $1/$2', 'घर $1/$2']],
  [/^Room ([A-Z0-9]{5})$/, ['Room $1', 'रूम $1']],
  [/^(.+) won!$/, ['$1 jeet gaya!', '$1 जीत गया!']],
  [/^(.+)’s turn$/, ['$1 ki baari', '$1 की बारी']],
  [/^(.+) is thinking\.\.\.$/, ['$1 soch raha hai...', '$1 सोच रहा है...']],
  [/^Bot · Home (\d+)\/(\d+)$/, ['Computer · Ghar $1/$2', 'कंप्यूटर · घर $1/$2']],
  [/^Your turn · (\d+:\d+)$/, ['Aapki baari · $1', 'आपकी बारी · $1']],
  [/^\+(\d+) coins$/, ['+$1 coins', '+$1 सिक्के']],
  [/^(\d+) wins?$/, ['$1 jeet', '$1 जीत']],
  [/^Claim Day (\d) reward$/, ['Din $1 ka inaam lo', 'दिन $1 का इनाम लो']],
  [/^Day (\d)$/, ['Din $1', 'दिन $1']],
  [/^Level (\d+)$/, ['Level $1', 'स्तर $1']]
];
export const LANGS = [['en', 'English'], ['hng', 'Hinglish'], ['hi', 'हिंदी']];
let lang = 'en', map = null;
// Every text we change remembers its English, so the language can change again at once (no reload).
const orig = new Map();      // text node -> English text
const origPh = new Map();    // input -> English placeholder
export function setLang(l) {
  lang = ['hng', 'hi'].includes(l) ? l : 'en';
  // Put English back first.
  for (const [n, t] of orig) { if (n.isConnected) n.nodeValue = t; }
  for (const [n, t] of origPh) { if (n.isConnected) n.placeholder = t; }
  orig.clear(); origPh.clear();
  if (lang === 'en') { map = null; document.documentElement.lang = 'en'; return; }
  const k = lang === 'hng' ? 1 : 2; map = new Map(T.map(r => [r[0], r[k]]));
  document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
  fix(document.body);
  if (!setLang.obs) {
    setLang.obs = new MutationObserver(list => { if (!map) return; for (const m of list) { if (m.type === 'characterData') fixText(m.target); else m.addedNodes.forEach(n => fix(n)); } });
    setLang.obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    // Forget texts that are gone from the screen.
    setInterval(() => { for (const n of orig.keys()) if (!n.isConnected) orig.delete(n); for (const n of origPh.keys()) if (!n.isConnected) origPh.delete(n); }, 20000);
  }
}
export function tr(s) { if (!map) return s; return swap(s) || s; }
function swap(t) {
  const x = t.trim(); if (!x) return null;
  const v = map.get(x); if (v != null) return t.replace(x, v);
  const k = lang === 'hng' ? 0 : 1;
  for (const [re, out] of RULES) if (re.test(x)) return t.replace(x, x.replace(re, out[k]));
  return null;
}
function fixText(n) {
  if (!map) return;
  const v = swap(n.nodeValue);
  if (v != null && v !== n.nodeValue) { if (!orig.has(n)) orig.set(n, n.nodeValue); n.nodeValue = v; }
}
function fix(root) {
  if (!map || !root) return;
  if (root.nodeType === 3) return fixText(root);
  if (root.nodeType !== 1 || root.tagName === 'SCRIPT' || root.tagName === 'STYLE' || root.tagName === 'svg') return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: n => (n.nodeType === 1 && (n.tagName === 'svg' || n.tagName === 'SCRIPT') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  let n = w.currentNode;
  while (n) {
    if (n.nodeType === 3) fixText(n);
    else if (n.placeholder) { const v = map.get(n.placeholder); if (v) { if (!origPh.has(n)) origPh.set(n, n.placeholder); n.placeholder = v; } }
    n = w.nextNode();
  }
}
