// © 2026 sanfer.chiu. All rights reserved. 授權條款見 LICENSE。
// ===== 卡片四邊偵測與拉正 =====
const CardEdge = (() => {
  const RATIO = 1.586;
  const EDGE = 22;          // 相鄰像素差達此值視為邊緣
  const MIN_SCORE = 0.55;   // 一條邊至少要有這麼多取樣點是邊緣
  const SIDES = ['top', 'right', 'bottom', 'left'];

  // 回傳 gx（左右方向的變化，用來找直邊）與 gy（上下方向，找橫邊）
  function edgeMaps({ data, width, height }) {
    const gx = new Uint8Array(width * height), gy = new Uint8Array(width * height);
    const diff = (a, b) => data[a + 3] && data[b + 3] // 超出影像的透明區不算邊
      ? Math.max(Math.abs(data[a] - data[b]), Math.abs(data[a + 1] - data[b + 1]), Math.abs(data[a + 2] - data[b + 2])) : 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x, p = i * 4;
        gx[i] = diff(p - 4, p + 4) >= EDGE ? 1 : 0;
        gy[i] = diff(p - width * 4, p + width * 4) >= EDGE ? 1 : 0;
      }
    }
    return { gx, gy };
  }

  // 找一側的候選直線。橫邊：y = c + k(x - mid)；直邊：x = c + k(y - mid)
  function findLines(map, width, height, box, side) {
    const flat = side === 'top' || side === 'bottom';
    const from = flat ? box.x + box.w * 0.1 : box.y + box.h * 0.12;
    const to = flat ? box.x + box.w * 0.9 : box.y + box.h * 0.88;
    const mid = flat ? box.x + box.w / 2 : box.y + box.h / 2;
    const expected = { top: box.y, bottom: box.y + box.h, left: box.x, right: box.x + box.w }[side];
    const tol = flat ? box.h * 0.17 : box.w * 0.12;
    const found = [];
    for (let degree = -8; degree <= 8; degree++) {
      const k = Math.tan(degree * Math.PI / 180);
      for (let c = Math.round(expected - tol); c <= expected + tol; c++) {
        let hits = 0, total = 0;
        for (let t = from; t <= to; t += 2) {
          const along = Math.round(t), across = Math.round(c + k * (t - mid));
          total++;
          for (let d = -1; d <= 1; d++) {
            const x = flat ? along : across + d, y = flat ? across + d : along;
            if (x >= 0 && y >= 0 && x < width && y < height && map[y * width + x]) { hits++; break; }
          }
        }
        if (hits / total >= MIN_SCORE) found.push({ c, k, mid, flat, score: hits / total });
      }
    }
    // 分數相同時取靠中間者；相近的線只留一條
    found.sort((a, b) => b.score - a.score || Math.abs(a.k) - Math.abs(b.k));
    const kept = [];
    for (const line of found) {
      if (kept.every(other => Math.abs(other.c - line.c) > 6)) kept.push(line);
      if (kept.length === 5) break;
    }
    return kept;
  }

  function cross(flat, upright) {
    // y = c1 + k1(x - m1)、x = c2 + k2(y - m2)
    const a = flat.c - flat.k * flat.mid, b = upright.c - upright.k * upright.mid;
    const y = (a + flat.k * b) / (1 - flat.k * upright.k);
    return { x: b + upright.k * y, y };
  }

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function measure([tl, tr, br, bl]) {
    const top = dist(tl, tr), bottom = dist(bl, br), left = dist(tl, bl), right = dist(tr, br);
    return {
      w: (top + bottom) / 2, h: (left + right) / 2,
      skew: Math.max(top / bottom, bottom / top, left / right, right / left),
      tilt: Math.atan2(tr.y - tl.y + br.y - bl.y, tr.x - tl.x + br.x - bl.x) * 180 / Math.PI,
      cx: (tl.x + tr.x + br.x + bl.x) / 4, cy: (tl.y + tr.y + br.y + bl.y) / 4
    };
  }

  // image：含取景框外圍的影像；box：取景框在影像中的位置
  function detect(image, box) {
    const { gx, gy } = edgeMaps(image);
    const lines = {};
    for (const side of SIDES) {
      lines[side] = findLines(side === 'top' || side === 'bottom' ? gy : gx, image.width, image.height, box, side);
    }
    let best = null;
    for (const t of lines.top) for (const r of lines.right) for (const b of lines.bottom) for (const l of lines.left) {
      const quad = [cross(t, l), cross(t, r), cross(b, r), cross(b, l)];
      const m = measure(quad);
      if (Math.abs(m.w / m.h / RATIO - 1) > 0.1 || m.skew > 1.12 || m.w < box.w * 0.75) continue;
      if (quad.some(p => p.x < 0 || p.y < 0 || p.x > image.width || p.y > image.height)) continue;
      // 分數相近時偏好較外圈的組合，避免抓到卡面上的印刷線條
      const score = t.score + r.score + b.score + l.score + 0.8 * (m.w * m.h) / (box.w * box.h) - 2 * Math.abs(m.w / m.h / RATIO - 1);
      if (!best || score > best.score) best = { quad, score };
    }
    return { sides: Object.fromEntries(SIDES.map(s => [s, lines[s].length > 0])), quad: best && best.quad };
  }

  // 把來源的四邊形貼到 out（透視校正，雙線性取樣）
  function warp(source, quad, out) {
    const src = source.getContext('2d').getImageData(0, 0, source.width, source.height);
    const ctx = out.getContext('2d'), dst = ctx.createImageData(out.width, out.height);
    const [p0, p1, p2, p3] = quad;
    const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
    const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
    const den = dx1 * dy2 - dx2 * dy1;
    const g = (dx3 * dy2 - dx2 * dy3) / den, h = (dx1 * dy3 - dx3 * dy1) / den;
    const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + h * p3.x;
    const d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + h * p3.y;
    for (let j = 0; j < out.height; j++) {
      const v = (j + 0.5) / out.height;
      for (let i = 0; i < out.width; i++) {
        const u = (i + 0.5) / out.width, z = g * u + h * v + 1;
        const x = Math.min(Math.max((a * u + b * v + p0.x) / z, 0), source.width - 1.001);
        const y = Math.min(Math.max((d * u + e * v + p0.y) / z, 0), source.height - 1.001);
        const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
        const p = (y0 * source.width + x0) * 4, q = p + source.width * 4, o = (j * out.width + i) * 4;
        for (let n = 0; n < 3; n++) {
          dst.data[o + n] = (src.data[p + n] * (1 - fx) + src.data[p + 4 + n] * fx) * (1 - fy)
            + (src.data[q + n] * (1 - fx) + src.data[q + 4 + n] * fx) * fy;
        }
        dst.data[o + 3] = 255;
      }
    }
    ctx.putImageData(dst, 0, 0);
  }

  // 需要調整的提示；空字串代表對準了。拉正可修掉小幅歪斜與遠近，門檻從寬
  function advice(result) {
    const { quad, sides, box } = result;
    if (!quad) {
      const missing = SIDES.filter(s => !sides[s]).map(s => ({ top: '上', right: '右', bottom: '下', left: '左' })[s]);
      if (missing.length >= 3) return '把整張卡放進框內';
      if (missing.length) return `還沒抓到${missing.join('、')}邊`;
      return '放平、對齊框線';
    }
    const m = measure(quad);
    if (m.w < box.w * 0.84) return '靠近一點';
    if (m.w > box.w * 1.14) return '拿遠一點';
    if (m.cx - (box.x + box.w / 2) > box.w * 0.09) return '卡片往左一點';
    if (box.x + box.w / 2 - m.cx > box.w * 0.09) return '卡片往右一點';
    if (m.cy - (box.y + box.h / 2) > box.h * 0.11) return '卡片往上一點';
    if (box.y + box.h / 2 - m.cy > box.h * 0.11) return '卡片往下一點';
    if (Math.abs(m.tilt) > 7) return '轉正一點';
    if (m.skew > 1.09) return '手機放平一點';
    return '';
  }

  // 清晰度：卡片中央相鄰像素差的平方平均，越大越清楚
  function sharpness(full, result) {
    const f = result.toFull, m = measure(result.quad);
    const w = Math.round(m.w * f * 0.7), h = Math.round(m.h * f * 0.7);
    const { data } = full.getContext('2d').getImageData(Math.round(m.cx * f - w / 2), Math.round(m.cy * f - h / 2), w, h);
    let sum = 0, count = 0;
    for (let y = 0; y < h; y += 4) {
      for (let x = 1; x < w; x++, count++) {
        const i = (y * w + x) * 4 + 1, d = data[i] - data[i - 4];
        sum += d * d;
      }
    }
    return sum / count;
  }

  return { detect, warp, advice, measure, sharpness, dist };
})();
