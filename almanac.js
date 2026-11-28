// © 2026 sanfer.chiu. All rights reserved. 授權條款見 LICENSE。
// ===== 西曆、農曆、節氣、節日（離線查表） =====
// 瀏覽器內建的農曆在 2027 年春節等日子會差一天，故不用
const Almanac = (() => {
  const WEEK = '日一二三四五六';
  const TERMS = ['春分', '清明', '穀雨', '立夏', '小滿', '芒種', '夏至', '小暑', '大暑', '立秋', '處暑', '白露',
    '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至', '小寒', '大寒', '立春', '雨水', '驚蟄'];
  const MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '臘'];
  const DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  const dayName = d => d <= 10 ? `初${DIGITS[d]}` : d < 20 ? `十${DIGITS[d - 10]}` : d === 20 ? '二十' : d < 30 ? `廿${DIGITS[d - 20]}` : '三十';
  const STEMS = '甲乙丙丁戊己庚辛壬癸', BRANCHES = '子丑寅卯辰巳午未申酉戌亥';

  // 資料整理自香港天文台公曆與農曆對照表（2025–2050）
  const FIRST = Date.UTC(2025, 0, 29); // 正月初一
  const MONTH_CODE = 'babaabAbabbbababaabaabbbabbabaabaabbabbbabAabaabbabbabababaabbababbabababaabbAbabbabababaababbabbababaabababbbAbabaabababbabbabaabaabbabbbabaaBaababbbbabaabaababbbabababaababbabbAbababaababbababbabaabababbabbababAabababbabbabaabaabbabbbabaabaAbabbbbabaabaababbbabababaababbabbaBabaabababbabbabaababababbabbabaabaBababbab'; // a=29 天、b=30 天，大寫為閏月
  const TERM_DAYS = [ // 2025 起，每年 24 個節氣的日期（32 進位）
    '5k3i5k4k5l5l7m7n7n8n7m7l',
    '5k4i5k5k5l5l7n7n7n8n7m7m',
    '5k4j6l5k6l6l7n8n8n8n7m7m',
    '6k4j5k4j5k5l6m7m7m8n7m6l',
    '5k3i5k4k5l5l7m7n7n8n7m7l',
    '5k4i5k5k5l5l7n7n7n8n7m7m',
    '5k4j6l5k6l6l7n8n8n8n7m7m',
    '6k4j5k4j5k5l6m7m7m8n7m6l',
    '5k3i5k4k5l5l7m7n7n8n7m7l',
    '5k4i5k5k5l5l7n7n7n8n7m7m',
    '5k4j6l5k5l6l7n7n8n8n7m7m',
    '6k4j5k4j5k5l6m7m7m8n7m6l',
    '5k3i5k4k5l5l7m7n7n8n7m7l',
    '5k4i5k5k5l5l7n7n7n8n7m7m',
    '5k4j6l5k5l6l7n7n8n8n7m7m',
    '6k4j5k4j5k5l6m7m7m8n7m6l',
    '5k3i5k4k5k5l7m7n7m8n7m7l',
    '5k4i5k4k5l5l7n7n7n8n7m7m',
    '5k4j6l5k5l6l7n7n8n8n7m7m',
    '6k4j5k4j5k5l6m7m7m7n7m6l',
    '5k3i5k4j5k5l7m7n7m8n7m7l',
    '5k4i5k4k5l5l7m7n7n8n7m7m',
    '5k4j6l5k5l6l7n7n8n8n7m7m',
    '6k4j5k4j5k5k6m7m7m7n7l6l',
    '5j3i5k4j5k5l6m7m7m8n7m7l',
    '5k3i5k4k5l5l7m7n7n8n7m7m',
  ];

  // 展開成每個農曆月的起始日
  const STARTS = [];
  for (let i = 0, at = FIRST, year = 2025, month = 0; i < MONTH_CODE.length; i++) {
    const c = MONTH_CODE[i], leap = c !== c.toLowerCase();
    if (!leap) { month = month % 12 + 1; if (month === 1 && i) year++; }
    STARTS.push({ at, year, month, leap });
    at += (c.toLowerCase() === 'a' ? 29 : 30) * 86400000;
  }
  const END = STARTS[STARTS.length - 1].at + 29 * 86400000;

  // y、m、d 為西曆日期（m 從 1 起）；超出資料範圍回傳 null
  function lunar(y, m, d) {
    const day = Date.UTC(y, m - 1, d);
    if (day < FIRST || day >= END) return null;
    let i = STARTS.length - 1;
    while (STARTS[i].at > day) i--;
    const s = STARTS[i];
    return { year: s.year, month: s.month, leap: s.leap, day: Math.round((day - s.at) / 86400000) + 1,
      ganzhi: STEMS[(s.year - 4) % 10] + BRANCHES[(s.year - 4) % 12] };
  }

  function solarTerm(y, m, d) {
    const days = TERM_DAYS[y - 2025];
    if (!days) return null;
    for (const i of [(m - 1) * 2, (m - 1) * 2 + 1]) {
      // 資料順序從小寒起；TERMS 從春分起
      if (parseInt(days[i], 32) === d) return TERMS[(i + 19) % 24];
    }
    return null;
  }

  const SOLAR = { '1/1': '元旦', '2/14': '西洋情人節', '2/28': '和平紀念日', '3/8': '婦女節', '4/4': '兒童節', '5/1': '勞動節',
    '8/8': '父親節', '9/28': '教師節', '10/10': '國慶日', '10/25': '光復節', '12/25': '聖誕節' };
  const LUNAR = { '1/1': '春節', '1/2': '初二回娘家', '1/15': '元宵節', '5/5': '端午節', '7/7': '七夕', '7/15': '中元節', '8/15': '中秋節', '9/9': '重陽節', '12/8': '臘八節' };

  function festivals(y, m, d) {
    const list = [], cal = lunar(y, m, d);
    if (!cal) return SOLAR[`${m}/${d}`] ? [SOLAR[`${m}/${d}`]] : [];
    const tomorrow = new Date(Date.UTC(y, m - 1, d + 1));
    const next = lunar(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate());
    if (next && cal.month === 12 && next.month === 1) list.push('除夕');
    if (!cal.leap && LUNAR[`${cal.month}/${cal.day}`]) list.push(LUNAR[`${cal.month}/${cal.day}`]);
    if (SOLAR[`${m}/${d}`]) list.push(SOLAR[`${m}/${d}`]);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (m === 5 && weekday === 0 && d > 7 && d <= 14) list.push('母親節');
    return list;
  }

  // 回傳畫面需要的文字；節氣與節日只在當天出現
  function describe(date) {
    const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
    const cal = lunar(y, m, d);
    const two = n => String(n).padStart(2, '0');
    return {
      solar: `${y}/${two(m)}/${two(d)} 週${WEEK[date.getDay()]}`,
      lunar: cal ? `${cal.leap ? '閏' : ''}${MONTHS[cal.month - 1]}月${dayName(cal.day)}` : '',
      today: [solarTerm(y, m, d), ...festivals(y, m, d)].filter(Boolean)
    };
  }

  return { describe, solarTerm, lunar, festivals };
})();
