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
  ["Mr Malk Milad", "01141826361"],
  ["Mr Ramy Oncy", "01288471261"],
  ["Mr Ayman Labib", "01224004237"],
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

// name, icon, type, format, teamSize, manager, singlesOnly
const GAMES = [
  ["كرة القدم", "football", "roster", "league", 1, "Mr Gazo", false],
  ["الكرة الطائرة", "volleyball", "roster", "league", 1, "", false],
  ["الشطرنج", "chess", "players", "league", 1, "Mr Weza", false],
  ["البلياردو", "billiard", "players", "league", 1, "Mr Marsleno Ayman", false],
  ["تنس الطاولة", "pingpong", "players", "league", 1, "Mr Soliman Hefzy", false],
  ["الدومينو", "domino", "players", "league", 1, "Fr Philopater Girgis & Mr Adry", false],
  ["الطاولة", "tawla", "players", "league", 1, "Fr Philopater Girgis", true],
  ["الكوتشينة", "cards", "showcase", "league", 1, "Mr Andrew Amir", false],
  ["بلايستيشن", "gamepad", "station", "league", 1, "Mr Andrew Samir", false],
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
}

async function seedIfEmpty() {
  const { rows } = await pool.query("SELECT COUNT(*) FROM users");
  if (Number(rows[0].count) > 0) return;

  for (const [name, color] of TEAMS) {
    await pool.query("INSERT INTO teams (id, name, color) VALUES ($1, $2, $3)", [randomUUID(), name, color]);
  }

  for (const [name, phone] of FULL_ACCESS) {
    await pool.query("INSERT INTO users (id, name, phone, password, role) VALUES ($1, $2, $3, $3, 'full')", [
      randomUUID(),
      name,
      phone,
    ]);
  }
  for (const [name, phone] of LIMITED_ACCESS) {
    await pool.query("INSERT INTO users (id, name, phone, password, role) VALUES ($1, $2, $3, $3, 'limited')", [
      randomUUID(),
      name,
      phone,
    ]);
  }

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

  for (const [name, icon, type, format, teamSize, manager, singlesOnly] of GAMES) {
    const gameId = randomUUID();
    await pool.query(
      "INSERT INTO games (id, name, icon, type, format, team_size, manager, singles_only, all_served_view) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
      [gameId, name, icon, type, format, teamSize, manager, singlesOnly, type === "showcase"]
    );
    const cards = SHOWCASE_CARDS[icon];
    if (cards) {
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
