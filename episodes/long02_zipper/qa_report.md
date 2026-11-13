# LONG 02 quality gates

File: `LONG02_how_zippers_work.mp4`, 7805 frames, 260.17 s (4:20.17), 1920x1080, 30 fps.

| Gate | Result | Numbers |
|---|---|---|
| Luma per second 60-140 | PASS | min 64.0 (s 111), max 133.9 (s 143), mean 93.6 |
| Clipped white ≤5% for ≤0.3 s | PASS | longest run with >5% clipped: 0.00 s; max clipped fraction 0.20% at 49.40 s |
| Shots per minute / longest shot ≤ 8 s (L2) | PASS | 53 shots in 4.34 min = 12.2/min (body 52 shots, 13.0/min); longest body shot 7.50 s (shot 42, ARCH), mean 4.62 s; end screen 20.03 s |
| Shot mix (mechanism target ~55/25/5/15) | NOTE | 3D 124.8 s = 52.0%, 2D 65.8 s = 27.4%, TYPE 36.1 s = 15.0%, ARCH 13.5 s = 5.6% (over 240.1 s, end screen excluded) |
| First twist ≤ 8 s | PASS | "A zipper has no lock, no hook, and no glue.": "glue" ends at 2.77 s; motion from frame 0 (frame-0→1 change 2.66) |
| Longest stretch without visual change | PASS | 1.97 s (ending 139.33 s), threshold mean |ΔY| < 0.25 |
| Longest unchanged text ≤ 2 s | PASS | 1.00 s (ending frame 6110, 203.67 s) |
| Narration silence < 4 s | PASS | longest pause between words 2.18 s at 202.34 s |
| Chapter timestamps | PASS | 0:00 HOOK · 0:17 CH1 · 0:47 CH2 · 1:22 CH3 · 2:05 CH4 · 2:39 CH5 · 3:24 CH6 · 3:53 PAY · 4:00 END |
| Loudness -14 LUFS, true peak ≤ -1.5 dBFS, stereo | PASS | I = -14.0 LUFS, true peak = -3.0 dBFS, channels = 2 |
| Archival licenses in credits.md | PASS | 2 files, 2 logged; licenses: Public domain, Public domain |
| No brand names / logos | PASS | 42 brand / maker names searched in every on-screen string and in the narration: none found; no logos in the archival set (checked by eye); 3D parts unbranded |
| End screen element areas clean 20 s | PASS | 20.03 s; in 2 video slots + subscribe circle the overlay alpha stays ≤ 108/255 (flat dark tint only), colour std 0.00 (no text) |
| Voice sibilance (5-9 kHz / 0.3-3 kHz), new vs LONG 01 | PASS | new voice 0.0316 (-15.0 dB) vs LONG 01 voice 0.0464 (-13.3 dB): -1.7 dB |

Overall: ALL PASS (13 gates incl. the new voice sibilance gate; the shot mix is reported, not gated)
Voice test on the same hook text: old chain (LONG 01 settings + stretch) 0.0703 (-11.5 dB) vs new chain 0.0340 (-14.7 dB): -3.2 dB.

Luma per second: 0:119 1:118 2:117 3:110 4:107 5:115 6:110 7:100 8:86 9:69 10:68 11:68 12:80 13:90 14:105 15:71 16:65 17:77 18:115 19:116 20:115 21:115 22:116 23:118 24:118 25:118 26:119 27:117 28:105 29:70 30:70 31:70 32:68 33:72 34:68 35:67 36:67 37:73 38:104 39:105 40:105 41:106 42:69 43:66 44:66 45:65 46:66 47:89 48:116 49:119 50:116 51:117 52:118 53:117 54:120 55:122 56:123 57:124 58:125 59:127 60:80 61:68 62:68 63:68 64:68 65:68 66:68 67:68 68:68 69:68 70:71 71:70 72:113 73:113 74:112 75:112 76:73 77:66 78:66 79:87 80:96 81:102 82:91 83:96 84:102 85:106 86:92 87:68 88:69 89:69 90:69 91:69 92:85 93:94 94:95 95:95 96:95 97:96 98:97 99:98 100:99 101:76 102:67 103:67 104:67 105:67 106:94 107:114 108:115 109:117 110:106 111:64 112:65 113:65 114:64 115:66 116:68 117:68 118:69 119:69 120:67 121:65 122:65 123:65 124:65 125:93 126:117 127:119 128:110 129:110 130:110 131:110 132:110 133:96 134:68 135:68 136:68 137:68 138:68 139:68 140:89 141:130 142:132 143:134 144:131 145:129 146:122 147:112 148:112 149:113 150:112 151:113 152:113 153:111 154:68 155:68 156:69 157:70 158:70 159:107 160:105 161:109 162:115 163:115 164:114 165:114 166:120 167:121 168:115 169:97 170:97 171:101 172:104 173:103 174:102 175:102 176:102 177:102 178:103 179:104 180:90 181:67 182:69 183:87 184:121 185:121 186:122 187:123 188:124 189:124 190:125 191:126 192:126 193:128 194:129 195:130 196:131 197:76 198:68 199:68 200:68 201:68 202:69 203:69 204:99 205:116 206:117 207:120 208:94 209:67 210:68 211:68 212:68 213:68 214:90 215:106 216:106 217:107 218:108 219:109 220:109 221:74 222:72 223:72 224:72 225:72 226:72 227:70 228:69 229:70 230:70 231:70 232:71 233:95 234:119 235:119 236:120 237:120 238:123 239:117 240:108 241:100 242:92 243:92 244:91 245:91 246:91 247:91 248:91 249:91 250:91 251:91 252:91 253:91 254:91 255:91 256:91 257:91 258:91 259:91 260:91
