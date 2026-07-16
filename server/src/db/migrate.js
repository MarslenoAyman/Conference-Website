import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { pool } from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FULL_ACCESS = [
  ["Mr Amir Ashraf", "01221159696"],
  ["Mr Kiro Ehab", "01211771417"],
  ["Mr Tobia", "01211399908"],
  ["Fr Philopater Girgis", "01224788838"],
  ["Mr Hany Moris", "01223314101"],
  ["Mr Magdy", "01224886381"],
  ["Mr Marsleno Ayman", "01226047442"],
  ["Mr Philopater Ghobrial", "01221883485"],
];

const LIMITED_ACCESS = [
  ["Mr Ehab Heneen", "01223980335"],
  ["Mr Emil Adle", "01222295111"],
  ["Mr George Fathy", "01224522603"],
  ["Mr Marcos Adel", "01227035303"],
  ["Mr Soliman Hefzy", "01033396663"],
  ["Mr Andrew Amir", "01212670889"],
  ["Mr Andrew Samir", "01202148907"],
  ["Mr Gazo", "01225862929"],
  ["Mr Hady Demian", "01272005256"],
  ["Mr Mark Ehab", "01141826361"],
  ["Mr Ramy Oncy", "01288471261"],
  ["Mr Ayman Labib", "01224004237"],
  ["Mr Kadry", "01283345629"],
  ["Mr Weza", "01141826361"],
  ["Mr Kiro Hazem", "01228763295"],
  ["Mr Pavly Samir", "01207601856"],
];

const INSTRUCTIONS = [
  "احضر إلى دار المؤتمر بحلول الساعة 4:00 مساءً يوم الجمعة.",
  "أحضر كتابك المقدس ودفترك وأغراضك الشخصية وطبقة دافئة لصلاة العشية.",
  "الهواتف على الوضع الصامت أثناء جميع الجلسات والصلوات.",
  "احترم الجدول الزمني — الخدام ينسقون التنقل بين الأنشطة.",
];

const TIMELINE = [
  {
    label: "الجمعة",
    sessions: [
      ["4:00 م", "الوصول والتسجيل"],
      ["5:00 م", "صلاة الافتتاح والترحيب"],
      ["6:30 م", "العشاء"],
      ["8:00 م", "الموضوع الروحي الأول"],
      ["10:00 م", "ألعاب الفريق"],
      ["11:30 م", "صلاة نوم وراحة"],
    ],
  },
  {
    label: "السبت",
    sessions: [
      ["7:30 ص", "صلاة باكر"],
      ["8:00 ص", "الإفطار"],
      ["9:30 ص", "الموضوع الروحي الثاني"],
      ["1:00 ظ", "الغداء"],
      ["3:00 ع", "تحدٍ خارجي"],
      ["8:00 م", "حلقة القصص حول النار"],
    ],
  },
  {
    label: "الأحد",
    sessions: [
      ["7:30 ص", "صلاة باكر"],
      ["9:00 ص", "القداس الإلهي"],
      ["12:00 ظ", "الموضوع الختامي والإرسالية"],
      ["1:00 ظ", "الغداء والمغادرة"],
    ],
  },
];

// Real conference topics, adapted from the prepared study material.
const TOPICS = [
  ["هل الله يرفض الخطاة؟", "لم يتحدد", "الله لا يرفض الخاطئ بل يرفض الخطية، ويفرح بكل خاطئ يتوب مهما ابتعد."],
  ["هل الله بعيد وقت الضيق؟", "لم يتحدد", "الله قريب منا في كل ضيقة، ولا يتركنا وحدنا وسط العاصفة."],
  ["هل الله متسلط؟", "لم يتحدد", "الله يعطينا حرية الاختيار ويدعونا بمحبة، ولا يفرض نفسه علينا بالقوة."],
  ["هل الله غضوب؟", "لم يتحدد", "غضب الله من الخطية لا يلغي محبته الثابتة والدائمة لكل خاطئ."],
  ["هل الله قاسٍ أو مهمل؟", "لم يتحدد", "الله طويل الأناة ومراحمه لا تزول، ولا يتعامل معنا بقسوة."],
  ["هل الله متحيز؟", "لم يتحدد", "الله لا يحابي الوجوه، فهو يحب كل إنسان بلا تمييز أو تفضيل."],
  ["هل الله حسب المزاج؟", "لم يتحدد", "الله ثابت لا يتغير، وينظر إلى قلبك أكثر من إنجازاتك."],
];

// name, icon, type, format, teamSize, manager, singlesOnly, nameKey
const GAMES = [
  ["كرة القدم", "football", "roster", "league", 1, "Mr Gazo", false, "football"],
  ["الكرة الطائرة", "volleyball", "roster", "league", 1, "", false, "volleyball"],
  ["كرة الحرق", "dodgeball", "roster", "league", 1, "Mr Mark Ehab", false, "dodgeball"],
  ["الشطرنج", "chess", "players", "league", 1, "Mr Weza", false, "chess"],
  ["البلياردو", "billiard", "players", "league", 1, "Mr Marsleno Ayman", false, "billiard"],
  ["تنس الطاولة", "pingpong", "players", "league", 1, "Mr Soliman Hefzy", false, "pingpong"],
  ["الدومينو", "domino", "players", "league", 1, "Fr Philopater Girgis & Mr Adry", false, "domino"],
  ["الطاولة", "tawla", "players", "league", 1, "Fr Philopater Girgis", true, "tawla"],
  ["الكوتشينة", "cards", "showcase", "league", 1, "Mr Andrew Amir", false, "cards"],
  ["بلايستيشن", "gamepad", "station", "league", 1, "Mr Andrew Samir", false, "playstation"],
  ["لعبة الحبار", "squid", "survival", "league", 1, "Mr Marsleno Ayman & Mr Amir Ashraf", false, "squid"],
  ["رويال رامبل", "ring", "rumble", "league", 1, "Mr Marsleno Ayman & Mr Amir Ashraf", false, "rumble"],
];

// Showcase cards seeded for a game (matched to the game by its icon key).
const SHOWCASE_CARDS = {
  cards: [
    ["اسكرو", "Screw", "screw"],
    ["كوتشينة", "Cochina", "cochina"],
  ],
  gamepad: [
    ["FIFA", "", "fifa"],
    ["PES", "", "pes"],
  ],
};

const TEAMS = [
  ["فريق مار مرقس", "#b5433d"],
  ["فريق مار جرجس", "#3d5a3d"],
  ["فريق العدرا مريم", "#3a5a8c"],
  ["فريق الأنبا أنطونيوس", "#a97a3a"],
];

export async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  await pool.query(schema);
  await seedIfEmpty();
  await renameAccounts();
  await ensureStaff();
  await ensureGames();
}

// One-off account renames applied on every startup (idempotent — after the
// first run the old name no longer exists, so nothing changes). Also updates
// any game/team where the old name is the responsible.
const RENAMES = [["Mr Malk Milad", "Mr Mark Ehab"]];
async function renameAccounts() {
  for (const [oldName, newName] of RENAMES) {
    // A seed-level rename changes both the login identity and the display name.
    await pool.query("UPDATE users SET name = $2, username = $2 WHERE name = $1 OR username = $1", [oldName, newName]);
    await pool.query("UPDATE games SET manager = REPLACE(manager, $1, $2) WHERE manager LIKE '%' || $1 || '%'", [
      oldName,
      newName,
    ]);
    await pool.query("UPDATE teams SET manager = REPLACE(manager, $1, $2) WHERE manager LIKE '%' || $1 || '%'", [
      oldName,
      newName,
    ]);
  }
}

// Make sure every defined servant (full/limited) account exists on every
// startup, so new staff are added to an already-seeded database (local or
// production) without a reset. Matched by their unique username; existing
// accounts are never touched (no password/role changes).
async function ensureStaff() {
  const seed = [
    ...FULL_ACCESS.map(([name, cred]) => [name, cred, "full"]),
    ...LIMITED_ACCESS.map(([name, cred]) => [name, cred, "limited"]),
  ];
  for (const [name, cred, role] of seed) {
    // `cred` is the login password (a phone number). Store it as the phone too,
    // unless another account already uses that phone (phone is unique) — then
    // leave phone null; login still works, it matches on username + password.
    const { rows: taken } = await pool.query("SELECT 1 FROM users WHERE phone = $1 AND name <> $2", [cred, name]);
    const phone = taken[0] ? null : cred;
    await pool.query(
      "INSERT INTO users (id, name, username, phone, password, role) VALUES ($1, $2, $2, $3, $4, $5) ON CONFLICT (name) DO NOTHING",
      [randomUUID(), name, phone, cred, role]
    );
  }
}

// The full games catalogue is fixed and not user-editable, so we make sure every
// defined game exists on every startup — new games are added to any database
// (including already-seeded local/production ones) without a reset, and existing
// games are kept in sync (type/system, translation key) without clobbering a
// manually-set responsible name. Games are matched by their unique icon key.
async function ensureGames() {
  for (const [name, icon, type, format, teamSize, manager, singlesOnly, nameKey] of GAMES) {
    const allServed = type === "showcase" || type === "survival" || type === "rumble";
    const { rows } = await pool.query("SELECT id FROM games WHERE icon = $1 LIMIT 1", [icon]);
    let gameId;
    if (rows[0]) {
      gameId = rows[0].id;
      await pool.query(
        `UPDATE games SET type = $1, format = $2, team_size = $3, singles_only = $4, all_served_view = $5,
         name_key = $6, manager = COALESCE(NULLIF(manager, ''), $7) WHERE id = $8`,
        [type, format, teamSize, singlesOnly, allServed, nameKey, manager, gameId]
      );
    } else {
      gameId = randomUUID();
      await pool.query(
        `INSERT INTO games (id, name, icon, type, format, team_size, manager, singles_only, all_served_view, name_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [gameId, name, icon, type, format, teamSize, manager, singlesOnly, allServed, nameKey]
      );
    }
    // Seed showcase cards once (Card Game: Screw/Cochina, Play Station: FIFA/PES).
    const cards = SHOWCASE_CARDS[icon];
    if (cards) {
      const { rows: have } = await pool.query("SELECT COUNT(*)::int AS n FROM game_cards WHERE game_id = $1", [gameId]);
      if (have[0].n === 0) {
        let sort = 0;
        for (const [cardTitle, cardSub, art] of cards) {
          await pool.query(
            "INSERT INTO game_cards (id, game_id, title, subtitle, art, sort) VALUES ($1, $2, $3, $4, $5, $6)",
            [randomUUID(), gameId, cardTitle, cardSub, art, sort++]
          );
        }
      }
    }
  }
}

async function seedIfEmpty() {
  const { rows } = await pool.query("SELECT COUNT(*) FROM users");
  if (Number(rows[0].count) > 0) return;

  for (const [name, color] of TEAMS) {
    await pool.query("INSERT INTO teams (id, name, color) VALUES ($1, $2, $3)", [randomUUID(), name, color]);
  }

  // Staff accounts are created (and kept in sync) by ensureStaff(), which runs
  // on every startup and safely handles the username column + phone collisions.

  for (const text of INSTRUCTIONS) {
    await pool.query("INSERT INTO instructions (id, text) VALUES ($1, $2)", [randomUUID(), text]);
  }

  let dayNumber = 1;
  for (const day of TIMELINE) {
    const dayId = randomUUID();
    await pool.query("INSERT INTO timeline_days (id, day_number, label) VALUES ($1, $2, $3)", [
      dayId,
      dayNumber++,
      day.label,
    ]);
    for (const [time, title] of day.sessions) {
      await pool.query("INSERT INTO timeline_sessions (id, day_id, time, title) VALUES ($1, $2, $3, $4)", [
        randomUUID(),
        dayId,
        time,
        title,
      ]);
    }
  }

  for (const [title, speaker, description] of TOPICS) {
    await pool.query("INSERT INTO topics (id, title, speaker, description) VALUES ($1, $2, $3, $4)", [
      randomUUID(),
      title,
      speaker,
      description,
    ]);
  }
  // Games are created by ensureGames(), which runs on every startup.
}
