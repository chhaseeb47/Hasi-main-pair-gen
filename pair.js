import express from "express";
import fs from "fs";
import pino from "pino";
import {
    makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import pn from "awesome-phonenumber";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

/* ===== SHORT SESSION ID GENERATOR WITH BASE64 ENCODING ===== */
async function generateShortSession(credsPath) {
    try {
        // Read the actual creds.json file
        const credsData = fs.readFileSync(credsPath, 'utf-8');
         
        // Encode the credentials to base64
        const base64Creds = Buffer.from(credsData).toString('base64');
        
        // Generate session ID with prefix
        const y = new Date().getFullYear();
        const r = Math.random().toString(36).substring(2, 6).toUpperCase();
        const sessionId = `HASI-MD~`;
        
        // Return both session ID and encoded data
        return {
            sessionId: sessionId,
            encodedData: base64Creds
        };
    } catch (error) {
        console.error("Error generating short session:", error);
        return null;
    }
}

/* ===== HELPERS ===== */
function rm(p) {
    try { 
        if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); 
    } catch(e) {
        console.log("Cleanup error:", e);
    }
}

/* ===== ROUTE ===== */
router.get("/", async (req, res) => {
    let num = (req.query.number || "").replace(/[^0-9]/g, "");
    if (!num) return res.status(400).send({ code: "Number required" });

    const phone = pn("+" + num);
    if (!phone.isValid()) return res.status(400).send({ code: "Invalid number" });
    num = phone.getNumber("e164").replace("+", "");

    const dir = "./session" + num;
    rm(dir);

    async function start() {
        const { state, saveCreds } = await useMultiFileAuthState(dir);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
            },
            logger: pino({ level: "fatal" }),
            browser: Browsers.windows("Chrome"),
            printQRInTerminal: false,
            markOnlineOnConnect: false,
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
            if (connection === "open") {
                try {
                    // Wait for creds to be saved
                    await delay(3000);
                    
                    // Path to creds.json
                    const credsPath = join(dir, 'creds.json');
                    
                    // Generate short session with encoded data
                    const sessionInfo = await generateShortSession(credsPath);
                    
                    if (!sessionInfo) {
                        throw new Error("Failed to generate session");
                    }

                    const jid = jidNormalizedUser(num + "@s.whatsapp.net");

                    // 1️⃣ Send the COMPLETE session string (SESSION_ID + base64 data)
                    const completeSession = `${sessionInfo.sessionId}${sessionInfo.encodedData}`;
                    await sock.sendMessage(jid, { 
                        text: `${completeSession}` 
                    });

                    // 2️⃣ Wait 2 seconds
                    await delay(2000);

                  // 3️⃣ Send bot info (ALIVE STYLE: Fake vCard + Image + Caption)

// ---- Fake vCard (quoted, upar show hoga) ----
const fakeVCardQuoted = {
  key: {
    fromMe: false,
    participant: "0@s.whatsapp.net",
    remoteJid: "status@broadcast"
  },
  message: {
    contactMessage: {
      displayName: "© 𝐅𝐊𝐱𝐆𝐇𝐎𝐒𝐓-𝐌𝐃_⁸⁷³_",
      vcard: `FK-HACKER:MD
VERSION:3.0
FN:© FKxGHOST-MD
ORG:FKxGHOST-MD;
TEL;type=CELL;type=VOICE;waid=13135550002:+13135550002
END:VCARD`
    }
  }
};

// ---- Caption (alive.js style bot details) ----
const caption = `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ 𝐇ᴀsɪ 𝐌ᴅ.  ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 👑 𝐎𝐰𝐧𝐞𝐫:* Haseeb
*│❀ 🤖 𝐁𝐚𝐢𝐥𝐞𝐲𝐬:* Multi Device
*│❀ 💻 𝐓𝐲𝐩𝐞:* NodeJs
*│❀ 🚀 𝐏𝐥𝐚𝐭𝐟𝐨𝐫𝐦:* Render
*│❀ ⚙️ 𝐌𝐨𝐝𝐞:* Public
*│❀ 🔣 𝐏𝐫𝐞𝐟𝐢𝐱:* [ . ]
*│❀ 🏷️ 𝐕𝐞𝐫𝐬𝐢𝐨𝐧:* 1.0.0
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> 📌 𝐏ᴏᴡᴇʀᴅ 𝐁ʏ 𝐇ᴀsɪ 𝐌ᴅ.
`;

// ---- Send IMAGE + caption, quoted with fake vCard ----
await sock.sendMessage(
  jid,
  {
    image: { url: "https://files.catbox.moe/8164u3.png" },
    caption,
    contextInfo: {
      mentionedJid: [jid],
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: "120363422510118376@newsletter",
        newsletterName: "𝐇ᴀsɪ 𝐌ᴅ",
        serverMessageId: 143
      }
    }
  },
  { quoted: fakeVCardQuoted }
);
                    // 4️⃣ Cleanup
                    await delay(2000);
                    rm(dir);
                    
                    // Exit gracefully
                    setTimeout(() => {
                        process.exit(0);
                    }, 1000);
                    
                } catch (err) {
                    console.error("❌ Error in pairing process:", err);
                    rm(dir);
                    
                    // Try to send error to user
                    try {
                        const jid = jidNormalizedUser(num + "@s.whatsapp.net");
                        await sock.sendMessage(jid, { 
                            text: "❌ Error generating session. Please try again." 
                        });
                    } catch(e) {}
                    
                    process.exit(1);
                }
            }

            if (connection === "close") {
                const c = lastDisconnect?.error?.output?.statusCode;
                if (c !== 401) {
                    setTimeout(() => start(), 2000);
                }
            }
        });

        if (!sock.authState.creds.registered) {
            await delay(3000);
            try {
                let code = await sock.requestPairingCode(num);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                if (!res.headersSent) {
                    res.send({ 
                        success: true, 
                        code: code,
                        message: "Scan QR code or use pairing code to connect" 
                    });
                }
            } catch(err) {
                console.error("Pairing error:", err);
                if (!res.headersSent) {
                    res.status(503).send({ 
                        code: "PAIR_FAIL", 
                        error: err.message 
                    });
                }
                rm(dir);
                process.exit(1);
            }
        }
    }

    start();
});

/* ===== SAFETY ===== */
process.on("uncaughtException", (err) => {
    const e = String(err);
    if (e.includes("conflict") || e.includes("not-authorized") || e.includes("Timed Out")) return;
    console.error("Crash:", err);
});

process.on("unhandledRejection", (err) => {
    console.error("Unhandled Rejection:", err);
});

export default router;
