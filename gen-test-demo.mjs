// Generate synthetic .dem files with valid HL2DEMO headers for testing
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const demoDir = join(process.cwd(), 'test-demos');
if (!existsSync(demoDir)) mkdirSync(demoDir);

function writeStr(buf, offset, str, len) {
  const b = Buffer.from(str, 'utf8');
  b.copy(buf, offset, 0, Math.min(b.length, len));
}

function makeDemo({ filename, server, client, map, gameDir, duration, ticks, extraBytes }) {
  // HL2DEMO header = 1072 bytes minimum
  // 0-7: magic "HL2DEMO\0"
  // 8-11: demo protocol (i32)
  // 12-15: network protocol (i32)
  // 16-275: server name (260 bytes)
  // 276-535: client name (260 bytes)
  // 536-795: map name (260 bytes)
  // 796-1055: game directory (260 bytes)
  // 1056-1059: duration (f32)
  // 1060-1063: ticks (i32)
  // 1064-1067: frames (i32)
  // 1068-1071: signon length (i32)
  const headerSize = 1072;
  const totalSize = headerSize + (extraBytes || 8192);
  const buf = Buffer.alloc(totalSize);

  // magic
  writeStr(buf, 0, 'HL2DEMO\0', 8);
  // demo protocol = 4
  buf.writeInt32LE(4, 8);
  // network protocol = 13987
  buf.writeInt32LE(13987, 12);
  // server name
  writeStr(buf, 16, server, 260);
  // client name
  writeStr(buf, 276, client, 260);
  // map name
  writeStr(buf, 536, map, 260);
  // game directory
  writeStr(buf, 796, gameDir, 260);
  // duration (float seconds)
  buf.writeFloatLE(duration, 1056);
  // ticks
  buf.writeInt32LE(ticks, 1060);
  // frames
  buf.writeInt32LE(Math.floor(ticks * 0.5), 1064);
  // signon length
  buf.writeInt32LE(4096, 1068);

  // fill rest with random-ish data to simulate file content
  for (let i = headerSize; i < totalSize; i++) {
    buf[i] = Math.floor(Math.random() * 256);
  }

  const path = join(demoDir, filename);
  writeFileSync(path, buf);
  console.log(`Created: ${path} (${(totalSize / 1024).toFixed(1)} KB)`);
}

// Generate several test demos with varied data
const demos = [
  { filename: 'de_mirage_2026-02-05_ranked.dem', server: 'valve-ams-12.steamcontent.com', client: 'Rqdiniz', map: 'de_mirage', gameDir: 'csgo', duration: 2340.5, ticks: 299584, extraBytes: 65536 },
  { filename: 'de_inferno_2026-02-03_faceit.dem', server: 'faceit-fra-04.faceit.com', client: 'Rqdiniz', map: 'de_inferno', gameDir: 'csgo', duration: 1876.2, ticks: 240154, extraBytes: 51200 },
  { filename: 'de_dust2_2026-01-30_wingman.dem', server: 'valve-mad-03.steamcontent.com', client: 'Rqdiniz', map: 'de_dust2', gameDir: 'csgo', duration: 1245.0, ticks: 159360, extraBytes: 32768 },
  { filename: 'de_anubis_2026-01-28_premier.dem', server: 'valve-ams-09.steamcontent.com', client: 'Rqdiniz', map: 'de_anubis', gameDir: 'csgo', duration: 2890.3, ticks: 369958, extraBytes: 81920 },
  { filename: 'de_ancient_2026-01-25_ranked.dem', server: 'valve-sto-01.steamcontent.com', client: 'Rqdiniz', map: 'de_ancient', gameDir: 'csgo', duration: 2100.7, ticks: 268890, extraBytes: 57344 },
  { filename: 'de_nuke_2026-01-22_scrimmage.dem', server: 'valve-fra-06.steamcontent.com', client: 'Rqdiniz', map: 'de_nuke', gameDir: 'csgo', duration: 1560.4, ticks: 199731, extraBytes: 40960 },
  { filename: 'de_vertigo_2026-02-07_practice.dem', server: '192.168.1.100:27015', client: 'Rqdiniz', map: 'de_vertigo', gameDir: 'csgo', duration: 456.1, ticks: 58381, extraBytes: 12288 },
];

for (const d of demos) makeDemo(d);

console.log(`\nGenerated ${demos.length} test demos in: ${demoDir}`);
