const { Bot, GrammyError, HttpError } = require("grammy");
const fs = require("fs");
require("dotenv").config();

// ========== ۱. تنظیمات اولیه ==========
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error("❌ BOT_TOKEN در Environment Variables تنظیم نشده است!");
    process.exit(1);
}

const CONFIG_FILE = "config.json";
const CHANNELS_FILE = "channels.json";

const DEFAULT_CONFIG = {
    emojis: ["👍", "❤️", "🔥", "🥰", "👏", "😍", "🙌", "🎉", "💯", "👌"],
    reactionChance: 70,
    maxReactionsPerMinute: 30,
};

let config = loadConfig();
let reactionStats = { total: 0, lastMinute: 0, lastReset: Date.now() };

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, "utf8");
            return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
        }
    } catch (e) {
        console.error("خطا در بارگذاری تنظیمات:", e.message);
    }
    return { ...DEFAULT_CONFIG };
}

function saveConfig(newConfig) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
        config = newConfig;
        return true;
    } catch (e) {
        console.error("خطا در ذخیره تنظیمات:", e.message);
        return false;
    }
}

// ========== ۲. مدیریت کانال‌ها ==========
function loadChannels() {
    try {
        if (fs.existsSync(CHANNELS_FILE)) {
            return JSON.parse(fs.readFileSync(CHANNELS_FILE, "utf8"));
        }
    } catch (e) {
        console.error("خطا در بارگذاری کانال‌ها:", e.message);
    }
    return [];
}

function saveChannels(channels) {
    try {
        fs.writeFileSync(CHANNELS_FILE, JSON.stringify(channels, null, 2));
        return true;
    } catch (e) {
        console.error("خطا در ذخیره کانال‌ها:", e.message);
        return false;
    }
}

function addChannel(channelId, addedBy) {
    const channels = loadChannels();
    const cleanId = channelId.toString().trim();

    if (channels.some(ch => ch.id === cleanId)) {
        return { success: false, message: "❌ این کانال قبلاً اضافه شده است!" };
    }

    channels.push({
        id: cleanId,
        addedBy: addedBy,
        addedAt: new Date().toISOString(),
        enabled: true
    });

    if (saveChannels(channels)) {
        return { success: true, message: `✅ کانال \`${cleanId}\` با موفقیت اضافه شد!` };
    }
    return { success: false, message: "❌ خطا در ذخیره کانال" };
}

function removeChannel(channelId) {
    let channels = loadChannels();
    const cleanId = channelId.toString().trim();
    const existed = channels.some(ch => ch.id === cleanId);

    channels = channels.filter(ch => ch.id !== cleanId);

    if (saveChannels(channels)) {
        return { 
            success: true, 
            message: existed ? `🗑️ کانال \`${cleanId}\` حذف شد.` : "⚠️ کانال یافت نشد." 
        };
    }
    return { success: false, message: "❌ خطا در حذف کانال" };
}

function listChannels() {
    const channels = loadChannels();
    if (channels.length === 0) {
        return "📭 هنوز هیچ کانالی اضافه نشده است.\nاز دستور /addchannel استفاده کنید.";
    }

    let text = "📺 **لیست کانال‌های ربات:**\n\n";
    channels.forEach((ch, i) => {
        text += `\( {i + 1}. \` \){ch.id}\` — ${ch.enabled ? "✅ فعال" : "⭕ غیرفعال"}\n`;
    });
    text += `\n📊 مجموع: ${channels.length} کانال`;
    return text;
}

function toggleChannel(channelId) {
    const channels = loadChannels();
    const cleanId = channelId.toString().trim();
    const channel = channels.find(ch => ch.id === cleanId);

    if (!channel) {
        return { success: false, message: "❌ کانال یافت نشد!" };
    }

    channel.enabled = !channel.enabled;
    saveChannels(channels);

    const status = channel.enabled ? "فعال" : "غیرفعال";
    return { success: true, message: `✅ کانال \`${cleanId}\` ${status} شد.` };
}

// ========== ۳. واکنش هوشمند ==========
async function reactToPost(ctx) {
    const now = Date.now();
    if (now - reactionStats.lastReset > 60000) {
        reactionStats.lastMinute = 0;
        reactionStats.lastReset = now;
    }

    if (reactionStats.lastMinute >= config.maxReactionsPerMinute) {
        return;
    }

    if (Math.random() * 100 > config.reactionChance) return;

    const randomEmoji = config.emojis[Math.floor(Math.random() * config.emojis.length)];

    try {
        await ctx.api.setMessageReaction(ctx.chat.id, ctx.msg.message_id, {
            reaction: [{ type: "emoji", emoji: randomEmoji }]
        });

        reactionStats.total++;
        reactionStats.lastMinute++;
        console.log(`✅ واکنش ${randomEmoji} زده شد`);
    } catch (error) {
        if (error?.error_code === 429) {
            console.warn("⚠️ Rate limit تلگرام");
        } else {
            console.error("❌ خطا در واکنش:", error.message);
        }
    }
}

// ========== ۴. بررسی کانال ==========
async function isChannelAllowed(chatId) {
    const channels = loadChannels();
    return channels.some(ch => ch.id === chatId.toString() && ch.enabled);
}

// ========== ۵. ایجاد ربات ==========
const bot = new Bot(BOT_TOKEN);

// ========== ۶. هندلرهای پیام ==========
bot.on("channel_post", async (ctx) => {
    if (await isChannelAllowed(ctx.chat.id)) {
        await reactToPost(ctx);
    }
});

bot.on("message", async (ctx) => {
    if (ctx.chat?.type === "channel" && await isChannelAllowed(ctx.chat.id)) {
        await reactToPost(ctx);
    }
});

// ========== ۷. دستورات ==========
const isOwner = (ctx) => {
    const ownerId = parseInt(process.env.OWNER_ID || "0");
    return ownerId && ctx.from?.id === ownerId;
};

bot.command("addchannel", async (ctx) => {
    const args = ctx.message.text.split(/\s+/);
    if (args.length < 2) {
        return ctx.reply("📝 استفاده:\n`/addchannel -1001234567890`\nیا\n`/addchannel @username`", 
            { parse_mode: "Markdown" });
    }
    const result = addChannel(args[1], ctx.from.id);
    await ctx.reply(result.message, { parse_mode: "Markdown" });
});

bot.command("removechannel", async (ctx) => {
    const args = ctx.message.text.split(/\s+/);
    if (args.length < 2) return ctx.reply("📝 استفاده: `/removechannel -100...`");
    const result = removeChannel(args[1]);
    await ctx.reply(result.message, { parse_mode: "Markdown" });
});

bot.command("listchannels", async (ctx) => {
    await ctx.reply(listChannels(), { parse_mode: "Markdown" });
});

bot.command("togglechannel", async (ctx) => {
    const args = ctx.message.text.split(/\s+/);
    if (args.length < 2) return ctx.reply("📝 استفاده: `/togglechannel -100...`");
    const result = toggleChannel(args[1]);
    await ctx.reply(result.message, { parse_mode: "Markdown" });
});

bot.command("setchance", async (ctx) => {
    if (!isOwner(ctx)) return ctx.reply("⛔ فقط صاحب ربات اجازه دارد.");
    const chance = parseInt(ctx.message.text.split(/\s+/)[1]);
    if (isNaN(chance) || chance < 0 || chance > 100) {
        return ctx.reply("❌ عدد بین ۰ تا ۱۰۰ وارد کنید.");
    }
    config.reactionChance = chance;
    saveConfig(config);
    await ctx.reply(`🎲 شانس واکنش به ${chance}% تغییر کرد.`);
});

bot.command("setemojis", async (ctx) => {
    if (!isOwner(ctx)) return ctx.reply("⛔ فقط صاحب ربات.");
    const emojis = ctx.message.text.split(/\s+/).slice(1).join(" ")
                    .split(/[,،\s]+/).filter(Boolean);
    if (emojis.length === 0) {
        return ctx.reply("📝 مثال:\n`/setemojis 👍 ❤️ 🔥 🥰`");
    }
    config.emojis = emojis;
    saveConfig(config);
    await ctx.reply(`✅ ایموجی‌ها بروزرسانی شد:\n${emojis.join("  ")}`);
});

bot.command("stats", async (ctx) => {
    const activeChannels = loadChannels().filter(c => c.enabled).length;
    await ctx.reply(
        `📊 **آمار ربات**\n\n` +
        `• کانال‌های فعال: ${activeChannels}\n` +
        `• کل واکنش‌ها: ${reactionStats.total}\n` +
        `• شانس واکنش: ${config.reactionChance}%\n` +
        `• تعداد ایموجی: ${config.emojis.length}\n` +
        `• وضعیت: 🟢 آنلاین`,
        { parse_mode: "Markdown" }
    );
});

bot.command("start", async (ctx) => {
    await ctx.reply(
        `🤖 **ربات واکنش‌زننده حرفه‌ای**\n\n` +
        `📌 دستورات اصلی:\n` +
        `/addchannel — اضافه کردن کانال\n` +
        `/listchannels — لیست کانال‌ها\n` +
        `/removechannel — حذف کانال\n` +
        `/togglechannel — فعال/غیرفعال\n\n` +
        `⚙️ تنظیمات (فقط صاحب ربات):\n` +
        `/setchance — تغییر شانس\n` +
        `/setemojis — تغییر ایموجی‌ها\n` +
        `/stats — آمار\n\n` +
        `⚠️ ربات باید **ادمین** کانال باشد.`,
        { parse_mode: "Markdown" }
    );
});

bot.command("help", (ctx) => ctx.reply("از دستور /start استفاده کنید."));

// ========== ۸. مدیریت خطاها ==========
bot.catch((err) => {
    console.error("خطای ربات:", err);
});

// ========== ۹. اجرا ==========
bot.start();
console.log(`🚀 ربات با موفقیت راه‌اندازی شد!`);
console.log(`🎯 شانس واکنش: ${config.reactionChance}% | ایموجی: ${config.emojis.length} عدد`);
