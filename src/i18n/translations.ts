import type { LanguageCode } from '../core/types';

export type TranslationKey =
  | 'app.title'
  | 'app.tagline'
  | 'app.subtitle'
  | 'cta.enterParlor'
  | 'cta.resumeSessions'
  | 'nav.games'
  | 'nav.daily'
  | 'nav.profile'
  | 'nav.settings'
  | 'hub.heading'
  | 'hub.subheading'
  | 'filter.all'
  | 'filter.strategy'
  | 'filter.race'
  | 'filter.puzzle'
  | 'filter.economy'
  | 'profile.title'
  | 'profile.level'
  | 'profile.xp'
  | 'profile.matches'
  | 'profile.winRate'
  | 'profile.historyEmpty'
  | 'settings.title'
  | 'settings.audio'
  | 'settings.soundEffects'
  | 'settings.volume'
  | 'settings.haptics'
  | 'settings.appearance'
  | 'settings.theme'
  | 'settings.language'
  | 'settings.accessibility'
  | 'settings.highContrast'
  | 'settings.colorblind'
  | 'settings.largeText'
  | 'settings.reducedMotion'
  | 'settings.privacy'
  | 'settings.analyticsConsent'
  | 'settings.cloudSync'
  | 'settings.exportSave'
  | 'settings.importSave'
  | 'settings.clearData'
  | 'daily.title'
  | 'daily.reward'
  | 'daily.completed'
  | 'daily.active'
  | 'ach.first_match.title'
  | 'ach.first_match.desc'
  | 'ach.first_victory.title'
  | 'ach.first_victory.desc'
  | 'ach.five_wins.title'
  | 'ach.five_wins.desc'
  | 'ach.three_game_explorer.title'
  | 'ach.three_game_explorer.desc'
  | 'ach.all_ten_explorer.title'
  | 'ach.all_ten_explorer.desc'
  | 'ach.hard_ai_victor.title'
  | 'ach.hard_ai_victor.desc'
  | 'ach.hot_streak_3.title'
  | 'ach.hot_streak_3.desc'
  | 'ach.swift_tactician.title'
  | 'ach.swift_tactician.desc';

const EN: Record<TranslationKey, string> = {
  'app.title': 'BOARDORA',
  'app.tagline': 'ONE WORLD. TEN GAMES. ENDLESS FUN.',
  'app.subtitle': 'Ten timeless tabletop classics crafted for offline play, smart AI, and family nights.',
  'cta.enterParlor': 'Enter Game Hall',
  'cta.resumeSessions': 'Recoverable Sessions',
  'nav.games': 'Games',
  'nav.daily': 'Daily Quest',
  'nav.profile': 'Profile & Stats',
  'nav.settings': 'Settings',
  'hub.heading': 'Welcome to BOARDORA',
  'hub.subheading': 'Choose any of the ten classic boards to inspect official rules, challenge tactical AI, or host a private table.',
  'filter.all': 'All Ten',
  'filter.strategy': 'Strategy',
  'filter.race': 'Race',
  'filter.puzzle': 'Puzzle',
  'filter.economy': 'Economy',
  'profile.title': 'Player Ledger',
  'profile.level': 'Level',
  'profile.xp': 'Experience',
  'profile.matches': 'Matches',
  'profile.winRate': 'Win Rate',
  'profile.historyEmpty': 'No completed matches yet. Your real match ledger will record here.',
  'settings.title': 'Boardora Preferences',
  'settings.audio': 'Audio & Tactile Feedback',
  'settings.soundEffects': 'Tabletop Sound Effects',
  'settings.volume': 'Master Volume',
  'settings.haptics': 'Haptic Vibration',
  'settings.appearance': 'Surface & Language',
  'settings.theme': 'Board Material Theme',
  'settings.language': 'Interface Language',
  'settings.accessibility': 'Accessibility',
  'settings.highContrast': 'High-Contrast Outlines',
  'settings.colorblind': 'Colorblind Piece Symbols',
  'settings.largeText': 'Large Readable Text',
  'settings.reducedMotion': 'Reduced Motion',
  'settings.privacy': 'Privacy & Data Controls',
  'settings.analyticsConsent': 'Optional Anonymous Analytics',
  'settings.cloudSync': 'Firebase Cloud Sync (When Signed In)',
  'settings.exportSave': 'Export Save JSON',
  'settings.importSave': 'Import Save JSON',
  'settings.clearData': 'Reset Local Data',
  'daily.title': 'Daily Tabletop Challenge',
  'daily.reward': 'Bonus XP',
  'daily.completed': 'Completed',
  'daily.active': 'Active Today',
  'ach.first_match.title': 'Opening Move',
  'ach.first_match.desc': 'Complete your first match in any of the ten games.',
  'ach.first_victory.title': 'First Crown',
  'ach.first_victory.desc': 'Win your first match.',
  'ach.five_wins.title': 'Royal Regular',
  'ach.five_wins.desc': 'Win 5 matches across the collection.',
  'ach.three_game_explorer.title': 'Curious Tactician',
  'ach.three_game_explorer.desc': 'Complete matches in at least 3 different games.',
  'ach.all_ten_explorer.title': 'Grand Tour Master',
  'ach.all_ten_explorer.desc': 'Complete at least one match in all 10 games.',
  'ach.hard_ai_victor.title': 'Iron Mind',
  'ach.hard_ai_victor.desc': 'Defeat a Hard difficulty AI opponent.',
  'ach.hot_streak_3.title': 'Unbroken Run',
  'ach.hot_streak_3.desc': 'Achieve a 3-win streak in any game.',
  'ach.swift_tactician.title': 'Swift Tactician',
  'ach.swift_tactician.desc': 'Win a match in 20 moves or fewer.',
};

const ES: Record<TranslationKey, string> = {
  ...EN,
  'app.subtitle': 'Diez clásicos de mesa diseñados para jugar sin conexión, con IA táctica y en familia.',
  'cta.enterParlor': 'Entrar al Salón',
  'nav.games': 'Juegos',
  'nav.daily': 'Reto Diario',
  'nav.profile': 'Perfil y Récord',
  'nav.settings': 'Ajustes',
  'hub.heading': 'Bienvenido a BOARDORA',
  'filter.all': 'Todos',
  'filter.strategy': 'Estrategia',
  'filter.race': 'Carrera',
  'filter.puzzle': 'Ingenio',
  'filter.economy': 'Economía',
  'settings.title': 'Preferencias de Boardora',
  'settings.language': 'Idioma de la Interfaz',
  'daily.title': 'Desafío Diario de Mesa',
};

const FR: Record<TranslationKey, string> = {
  ...EN,
  'app.subtitle': 'Dix classiques de plateau conçus pour le jeu hors ligne, l’IA tactique et la famille.',
  'cta.enterParlor': 'Entrer dans le Salon',
  'nav.games': 'Jeux',
  'nav.daily': 'Défi du Jour',
  'nav.profile': 'Profil & Stats',
  'nav.settings': 'Paramètres',
  'hub.heading': 'Bienvenue dans BOARDORA',
  'filter.all': 'Tous',
  'filter.strategy': 'Stratégie',
  'filter.race': 'Course',
  'filter.puzzle': 'Casse-tête',
  'filter.economy': 'Économie',
  'settings.title': 'Préférences Boardora',
  'settings.language': 'Langue de l’Interface',
  'daily.title': 'Défi Quotidien',
};

const HI: Record<TranslationKey, string> = {
  ...EN,
  'app.subtitle': 'ऑफ़लाइन खेल, स्मार्ट AI और पारिवारिक खेल रातों के लिए दस क्लासिक बोर्ड गेम।',
  'cta.enterParlor': 'गेम हॉल में प्रवेश करें',
  'nav.games': 'खेल',
  'nav.daily': 'दैनिक चुनौती',
  'nav.profile': 'प्रोफ़ाइल और आँकड़े',
  'nav.settings': 'सेटिंग्स',
  'hub.heading': 'BOARDORA में आपका स्वागत है',
  'filter.all': 'सभी दस',
  'filter.strategy': 'रणनीति',
  'filter.race': 'दौड़',
  'filter.puzzle': 'पहेली',
  'filter.economy': 'अर्थव्यवस्था',
  'settings.title': 'Boardora प्राथमिकताएँ',
  'settings.language': 'इंटरफ़ेस भाषा',
  'daily.title': 'दैनिक बोर्ड चुनौती',
};

const DICTIONARIES: Record<LanguageCode, Record<TranslationKey, string>> = {
  en: EN,
  es: ES,
  fr: FR,
  hi: HI,
};

export function translate(lang: LanguageCode, key: TranslationKey): string {
  return DICTIONARIES[lang]?.[key] ?? EN[key];
}
