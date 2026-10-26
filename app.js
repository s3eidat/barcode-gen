/* Barcode Gen — our own encoders for Code 128 (auto B/C), EAN-13, UPC-A and Code 39. No libraries. */
(function () {
  "use strict";
  var $ = S3.$, $$ = S3.$$;

  // ---------- Code 128 ----------
  var C128 = ("212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 " +
    "221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 " +
    "231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 " +
    "314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 " +
    "111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 " +
    "114131 311141 411131 211412 211214 211232 2331112").split(" ");
  function digitRun(s, i) { var j = i; while (j < s.length && s.charCodeAt(j) >= 48 && s.charCodeAt(j) <= 57) j++; return j - i; }
  function code128Values(s) {
    for (var k = 0; k < s.length; k++) { var cc = s.charCodeAt(k); if (cc < 32 || cc > 126) throw new Error("Code 128 here supports printable ASCII only (no “" + s[k] + "”)"); }
    if (!s.length) throw new Error("Enter a value");
    var out = [], set = null, i = 0, n = s.length;
    while (i < n) {
      var d = digitRun(s, i);
      var useC = (d === n && d % 2 === 0) || (d >= 4 && (i === 0 || i + d === n)) || d >= 6;
      if (useC && d % 2 && i > 0) useC = false; // odd run mid-string: one digit in B first, the even rest goes to C
      if (useC) {
        if (set !== "C") { out.push(set ? 99 : 105); set = "C"; }
        var take = d - (d % 2);
        for (var e = 0; e < take; e += 2) out.push(+s.substr(i + e, 2));
        i += take;
      } else {
        if (set !== "B") { out.push(set ? 100 : 104); set = "B"; }
        out.push(s.charCodeAt(i) - 32); i++;
      }
    }
    var sum = out[0];
    for (var j = 1; j < out.length; j++) sum += out[j] * j;
    out.push(sum % 103, 106);
    return out;
  }
  function widthsToBits(w) { var b = ""; for (var i = 0; i < w.length; i++) b += (i % 2 ? "0" : "1").repeat(+w[i]); return b; }
  function code128(s) { return { bits: code128Values(s).map(function (v) { return widthsToBits(C128[v]); }).join(""), quiet: 10, text: s }; }

  // ---------- EAN-13 / UPC-A ----------
  var L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
  var PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];
  function inv(b) { return b.replace(/./g, function (c) { return c === "1" ? "0" : "1"; }); }
  function eanCheck(d12) { var s = 0; for (var i = 0; i < 12; i++) s += +d12[i] * (i % 2 ? 3 : 1); return (10 - s % 10) % 10; }
  function upcCheck(d11) { var s = 0; for (var i = 0; i < 11; i++) s += +d11[i] * (i % 2 ? 1 : 3); return (10 - s % 10) % 10; }
  function eanBits(d13) {
    var p = PARITY[+d13[0]], b = "101";
    for (var i = 1; i <= 6; i++) { var l = L[+d13[i]]; b += p[i - 1] === "L" ? l : inv(l).split("").reverse().join(""); }
    b += "01010";
    for (i = 7; i <= 12; i++) b += inv(L[+d13[i]]);
    return b + "101";
  }
  function digitsOnly(v, okLens, name) {
    var d = v.replace(/[\s-]/g, "");
    if (!/^\d*$/.test(d)) throw new Error(name + " uses digits only");
    if (okLens.indexOf(d.length) < 0) throw new Error(name + " needs " + okLens.join(" or ") + " digits (you have " + d.length + ")");
    return d;
  }
  function ean13(v) {
    var d = digitsOnly(v, [12, 13], "EAN-13"), c = eanCheck(d.slice(0, 12)), note;
    if (d.length === 13 && +d[12] !== c) throw new Error("Check digit should be " + c + ", not " + d[12] + " (" + d.slice(0, 12) + c + ")");
    note = d.length === 12 ? "Check digit " + c + " added" : "Check digit " + c + " is valid";
    d = d.slice(0, 12) + c;
    return { bits: eanBits(d), quiet: 11, quietR: 7, digits: d, kind: "ean", note: note, text: d };
  }
  function upca(v) {
    var d = digitsOnly(v, [11, 12], "UPC-A"), c = upcCheck(d.slice(0, 11)), note;
    if (d.length === 12 && +d[11] !== c) throw new Error("Check digit should be " + c + ", not " + d[11] + " (" + d.slice(0, 11) + c + ")");
    note = d.length === 11 ? "Check digit " + c + " added" : "Check digit " + c + " is valid";
    d = d.slice(0, 11) + c;
    return { bits: eanBits("0" + d), quiet: 9, quietR: 9, digits: d, kind: "upc", note: note, text: d };
  }

  // ---------- Code 39 (wide:narrow = 3:1) ----------
  var C39CH = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%";
  var C39 = {
    "0": "000110100", "1": "100100001", "2": "001100001", "3": "101100000", "4": "000110001", "5": "100110000", "6": "001110000", "7": "000100101",
    "8": "100100100", "9": "001100100", A: "100001001", B: "001001001", C: "101001000", D: "000011001", E: "100011000", F: "001011000",
    G: "000001101", H: "100001100", I: "001001100", J: "000011100", K: "100000011", L: "001000011", M: "101000010", N: "000010011",
    O: "100010010", P: "001010010", Q: "000000111", R: "100000110", S: "001000110", T: "000010110", U: "110000001", V: "011000001",
    W: "111000000", X: "010010001", Y: "110010000", Z: "011010000", "-": "010000101", ".": "110000100", " ": "011000100", "*": "010010100",
    "$": "010101000", "/": "010100010", "+": "010001010", "%": "000101010"
  };
  function c39mod43(s) { var t = 0; for (var i = 0; i < s.length; i++) t += C39CH.indexOf(s[i]); return C39CH[t % 43]; }
  function code39(v, withCheck) {
    var s = v.toUpperCase();
    if (!s.length) throw new Error("Enter a value");
    for (var i = 0; i < s.length; i++) if (C39CH.indexOf(s[i]) < 0) throw new Error("Code 39 can't encode “" + s[i] + "”. Use A–Z, 0–9, space and - . $ / + %");
    if (withCheck) s += c39mod43(s);
    var full = "*" + s + "*", bits = "";
    for (i = 0; i < full.length; i++) {
      var p = C39[full[i]];
      for (var k = 0; k < 9; k++) bits += (k % 2 ? "0" : "1").repeat(p[k] === "1" ? 3 : 1);
      if (i < full.length - 1) bits += "0";
    }
    return { bits: bits, quiet: 10, text: "*" + s + "*", note: v !== v.toUpperCase() ? "Letters made uppercase" : withCheck ? "Check character " + s[s.length - 1] + " added" : "" };
  }

  function encode(fmt, v, o) {
    if (fmt === "ean13") return ean13(v);
    if (fmt === "upca") return upca(v);
    if (fmt === "code39") return code39(v, o.c39check);
    return code128(v);
  }

  // ---------- layout (px) shared by SVG and canvas ----------
  function layout(enc, o) {
    var m = o.mod, qL = enc.quiet, qR = enc.quietR || enc.quiet, bits = enc.bits, H = o.height, pad = Math.max(6, m * 4);
    var retail = !!enc.kind, fs = o.text ? (retail ? Math.max(11, m * 9) : Math.max(12, Math.round(m * 7 + 5))) : 0;
    var longEnd = H + (retail && o.text ? fs * 0.55 : 0);
    function isLong(i) {
      if (!retail || !o.text) return false;
      if (i < 3 || (i >= 45 && i < 50) || i >= 92) return true;
      return enc.kind === "upc" && ((i >= 3 && i < 10) || (i >= 85 && i < 92));
    }
    var bars = [], i = 0;
    while (i < bits.length) {
      if (bits[i] !== "1") { i++; continue; }
      var j = i, lg = isLong(i);
      while (j < bits.length && bits[j] === "1" && isLong(j) === lg) j++;
      bars.push({ x: (qL + i) * m, w: (j - i) * m, h: lg ? longEnd : H });
      i = j;
    }
    var texts = [], W = (qL + bits.length + qR) * m, textY = pad + H + (retail ? fs * 0.95 : fs * 1.15);
    if (o.text) {
      var X = function (mod) { return (qL + mod) * m; }, d = enc.digits;
      if (enc.kind === "ean") {
        texts.push({ x: X(-4), t: d[0], a: "middle" });
        for (var k = 0; k < 6; k++) texts.push({ x: X(3 + 7 * k + 3.5), t: d[1 + k], a: "middle" });
        for (k = 0; k < 6; k++) texts.push({ x: X(50 + 7 * k + 3.5), t: d[7 + k], a: "middle" });
      } else if (enc.kind === "upc") {
        texts.push({ x: X(-4), t: d[0], a: "middle", small: true });
        for (k = 0; k < 5; k++) texts.push({ x: X(10 + 7 * k + 3.5), t: d[1 + k], a: "middle" });
        for (k = 0; k < 5; k++) texts.push({ x: X(50 + 7 * k + 3.5), t: d[6 + k], a: "middle" });
        texts.push({ x: X(bits.length + 4), t: d[11], a: "middle", small: true });
      } else texts.push({ x: W / 2, t: enc.text, a: "middle" });
    }
    var Ht = pad * 2 + Math.max(longEnd, o.text ? textY - pad + fs * 0.25 : H);
    return { W: W, H: Math.ceil(Ht), pad: pad, bars: bars, texts: texts, fs: fs, textY: textY };
  }
  var FONT = "'OCR B','OCRB',Consolas,'DejaVu Sans Mono','Courier New',monospace";
  function toSvg(lay, o) {
    var s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + lay.W + '" height="' + lay.H + '" viewBox="0 0 ' + lay.W + " " + lay.H + '">' +
      '<rect width="100%" height="100%" fill="' + o.bg + '"/><g fill="' + o.fg + '" shape-rendering="crispEdges">';
    lay.bars.forEach(function (b) { s += '<rect x="' + b.x + '" y="' + lay.pad + '" width="' + b.w + '" height="' + b.h + '"/>'; });
    s += "</g>";
    if (lay.texts.length) {
      s += '<g fill="' + o.fg + '" font-family="' + FONT.replace(/"/g, "") + '" font-size="' + lay.fs + '">';
      lay.texts.forEach(function (t) { s += '<text x="' + t.x + '" y="' + lay.textY + '" text-anchor="' + t.a + '"' + (t.small ? ' font-size="' + Math.round(lay.fs * 0.75) + '"' : "") + ">" + S3.esc(t.t) + "</text>"; });
      s += "</g>";
    }
    return s + "</svg>";
  }
  function toCanvas(lay, o, scale) {
    var c = document.createElement("canvas"); c.width = lay.W * scale; c.height = lay.H * scale;
    var x = c.getContext("2d"); x.scale(scale, scale);
    x.fillStyle = o.bg; x.fillRect(0, 0, lay.W, lay.H); x.fillStyle = o.fg;
    lay.bars.forEach(function (b) { x.fillRect(b.x, lay.pad, b.w, b.h); });
    x.textAlign = "center"; x.textBaseline = "alphabetic";
    lay.texts.forEach(function (t) { x.font = (t.small ? Math.round(lay.fs * 0.75) : lay.fs) + "px " + FONT; x.fillText(t.t, t.x, lay.textY); });
    return c;
  }
  function canvasBytes(c) { return new Promise(function (res) { c.toBlob(function (b) { b.arrayBuffer().then(function (a) { res(new Uint8Array(a)); }); }, "image/png"); }); }

  // ---------- UI ----------
  var saved = S3.store("bcg") || {};
  var o = { fmt: saved.fmt || "code128", mod: saved.mod || 2, height: saved.height || 80, fg: saved.fg || "#000000", bg: saved.bg || "#ffffff", text: saved.text !== false, c39check: !!saved.c39check, scale: saved.scale || "2", batchFmt: saved.batchFmt || "svg" };
  var DEFAULTS = { code128: "S3EIDAT-2026", ean13: "400638133393", upca: "03600029145", code39: "S3EIDAT TOOLS" };
  var HINTS = { code128: "Letters, digits and symbols. Digit runs are packed with subset C automatically.", ean13: "12 digits (check digit added) or 13 (check digit verified).", upca: "11 digits (check digit added) or 12 (check digit verified).", code39: "A–Z, 0–9, space and - . $ / + %" };
  var cur = null, values = {};
  function save() { S3.store("bcg", { fmt: o.fmt, mod: o.mod, height: o.height, fg: o.fg, bg: o.bg, text: o.text, c39check: o.c39check, scale: o.scale, batchFmt: o.batchFmt }); }
  function seg(el, value, onPick) {
    $$("button", el).forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.v === value));
      b.addEventListener("click", function () { $$("button", el).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); onPick(b.dataset.v); });
    });
  }
  function render() {
    var v = $("#value").value, st = $("#status");
    values[o.fmt] = v;
    $("#c39checkWrap").hidden = o.fmt !== "code39";
    try { var enc = encode(o.fmt, v, o); }
    catch (e) { cur = null; st.className = "chip bad"; st.textContent = e.message; $("#stage").innerHTML = '<div class="empty"><b>No barcode yet</b>Fix the value to see it here.</div>'; $("#dims").textContent = ""; $("#hint").textContent = ""; return; }
    var lay = layout(enc, o);
    cur = { enc: enc, lay: lay, svg: toSvg(lay, o), name: (enc.digits || v).replace(/[^\w.-]+/g, "_").slice(0, 60) || "barcode" };
    st.className = "chip ok"; st.textContent = "Valid";
    $("#hint").textContent = enc.note || "";
    $("#stage").innerHTML = cur.svg; // our own SVG: every user string inside it went through S3.esc
    $("#dims").textContent = lay.W + " × " + lay.H + " px · " + enc.bits.length + " modules";
  }
  function setFmt(f) {
    o.fmt = f; save();
    $("#value").value = values[f] != null ? values[f] : DEFAULTS[f];
    $("#valueLabel").textContent = { code128: "Text or number", ean13: "EAN-13 digits", upca: "UPC-A digits", code39: "Text" }[f];
    $("#value").setAttribute("inputmode", f === "ean13" || f === "upca" ? "numeric" : "text");
    $("#value").title = HINTS[f]; $("#value").placeholder = DEFAULTS[f];
    render();
  }
  seg($("#format"), o.fmt, setFmt);
  seg($("#batchFmt"), o.batchFmt, function (v) { o.batchFmt = v; save(); });
  $("#value").addEventListener("input", S3.debounce(render, 80));
  [["mod", "modVal"], ["height", "heightVal"]].forEach(function (p) {
    var el = $("#" + p[0]); el.value = o[p[0]]; $("#" + p[1]).textContent = o[p[0]];
    el.addEventListener("input", function () { o[p[0]] = +el.value; $("#" + p[1]).textContent = el.value; save(); render(); });
  });
  ["fg", "bg"].forEach(function (k) { $("#" + k).value = o[k]; $("#" + k).addEventListener("input", function (e) { o[k] = e.target.value; save(); render(); }); });
  $("#text").checked = o.text; $("#text").addEventListener("change", function (e) { o.text = e.target.checked; save(); render(); });
  $("#c39check").checked = o.c39check; $("#c39check").addEventListener("change", function (e) { o.c39check = e.target.checked; save(); render(); });
  $("#scale").value = o.scale; $("#scale").addEventListener("change", function (e) { o.scale = e.target.value; save(); });

  function need() { if (!cur) S3.toast("Fix the value first", "error"); return !!cur; }
  $("#svg").addEventListener("click", function () { if (!need()) return; S3.download(cur.svg, cur.name + ".svg", "image/svg+xml"); S3.done(); });
  $("#png").addEventListener("click", function () { if (!need()) return; toCanvas(cur.lay, o, +o.scale).toBlob(function (b) { S3.download(b, cur.name + ".png"); S3.done(); }, "image/png"); });
  $("#copySvg").addEventListener("click", function () { if (need()) S3.copy(cur.svg, "SVG code copied"); });

  // ---------- batch ----------
  function batchParse() {
    var lines = $("#batch").value.split(/\r?\n/), ok = [], bad = [], used = {};
    lines.forEach(function (line, i) {
      var v = line.trim(); if (!v) return;
      if (ok.length + bad.length >= 1000) return;
      try {
        var enc = encode(o.fmt, v, o), base = (enc.digits || v).replace(/[^\w.-]+/g, "_").slice(0, 60) || "barcode", name = base, n = 2;
        while (used[name]) name = base + "-" + n++;
        used[name] = 1; ok.push({ enc: enc, name: name });
      } catch (e) { bad.push([i + 1, v, e.message]); }
    });
    return { ok: ok, bad: bad };
  }
  function batchInfo() {
    var r = batchParse(), tb = $("#batchErr");
    $("#batchInfo").textContent = r.ok.length || r.bad.length ? r.ok.length + " valid · " + r.bad.length + " with problems" + (r.bad.length ? " (skipped)" : "") : "Paste up to 1000 values. Each one becomes its own file in the zip.";
    tb.innerHTML = "";
    r.bad.slice(0, 50).forEach(function (b) { tb.appendChild(S3.h("tr", null, [S3.h("td", { text: String(b[0]) }), S3.h("td", { "class": "mono", text: b[1] }), S3.h("td", { text: b[2] })])); });
    $("#batchErrWrap").hidden = !r.bad.length;
    return r;
  }
  $("#batch").addEventListener("input", S3.debounce(batchInfo, 200));
  $("#batchGo").addEventListener("click", function () {
    var r = batchInfo();
    if (!r.ok.length) { S3.toast("Add at least one valid value", "error"); return; }
    var btn = this; btn.disabled = true;
    Promise.all(r.ok.map(function (x) {
      var lay = layout(x.enc, o);
      return o.batchFmt === "png" ? canvasBytes(toCanvas(lay, o, +o.scale)).then(function (b) { return { name: x.name + ".png", data: b }; }) : { name: x.name + ".svg", data: toSvg(lay, o) };
    })).then(function (files) {
      S3.download(S3.zip(files), "barcodes-" + o.fmt + ".zip"); S3.toast(files.length + " barcodes zipped"); S3.done();
    }).finally(function () { btn.disabled = false; });
  });

  setFmt(o.fmt);

  window.S3_DEMO = function () {
    $("#format button[data-v=ean13]").click();
    $("#value").value = "400638133393"; render();
    $("#batch").value = "590123412345\n400638133393\n12345\n978020137962"; batchInfo();
  };

  window.S3_SELFTEST = function () {
    var okSums = C128.every(function (p, i) { return p.split("").reduce(function (a, b) { return a + +b; }, 0) === (i === 106 ? 13 : 11); });
    var wiki = code128Values("Wikipedia").join(",") === "104,55,73,75,73,80,69,68,73,65,88,106";
    var num = code128Values("123456").join(",") === "105,12,34,56,44,106";
    var mixed = code128Values("AB1234567").join(",");
    var mixedOk = mixed.indexOf("104,33,34,17,99,23,45,67,") === 0;
    var c128bits = code128("A").bits === "11010010000" + "10100011000" + "10001011000" + "1100011101011"; // start B, 'A'(33), check 34, stop
    var e = ean13("400638133393"), eb = e.bits;
    var eanOk = eanCheck("400638133393") === 1 && e.digits === "4006381333931" && eb.length === 95 && eb.slice(0, 3) === "101" && eb.slice(45, 50) === "01010" &&
      eb.slice(3, 10) === L[0] && eb.slice(10, 17) === inv(L[0]).split("").reverse().join("") && eb.slice(50, 57) === inv(L[3]);
    var upcOk = upcCheck("03600029145") === 2 && upca("036000291452").digits === "036000291452";
    var badCheck = false; try { ean13("4006381333932"); } catch (x) { badCheck = /should be 1/.test(x.message); }
    var c39ok = Object.keys(C39).every(function (k) { return C39[k].split("1").length - 1 === 3; }) && c39mod43("CODE39") === "W" &&
      code39("A").bits.length === 3 * 15 + 2 && new Set(Object.values(C39)).size === 44;
    return okSums && wiki && num && mixedOk && c128bits && eanOk && upcOk && badCheck && c39ok;
  };
})();
