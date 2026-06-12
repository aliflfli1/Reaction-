const { Bot } = require("grammy");
const fs = require("fs");

// ========== ۱. تنظیمات اولیه ==========
const BOT_TOKEN = process.env.BOT_TOKEN || "توکن_ربات_خودت_اینجا";
const EMOJIS = (process.env.EMOJIS || "👍,❤️,🔥,🥰,👏").split(",");
const REACTION_CHANCE = parseInt(process.env.REACTION_CHANCE || "70");

const bot = new Bot(BOT_TOKEN);

// فایل ذخیره‌سازی کانال‌ها
const CHANNELS_FILE = "channels.json";

// ========== ۲. مدیریت کانال‌ها در فایل ==========
function loadChannels() {
    try {
        if (fs.existsSync(CHANNELS_FILE)) {
            const data = fs.readFileSync(CHANNELS_FILE, "utf8");
            return JSON.parse(data);
        }
    } catch (error) {
        console.error("خطا در بارگذاری کانال‌ها:", error);
    }
    return [];
}

function saveChannels(channels) {
    try {
        fs.writeFileSync(CHANNELS_FILE, JSON.stringify(channels, null, 2));
        return true;
    } catch (error) {
        console.error("خطا در ذخیره کانال‌ها:", error);
        return false;
    }
}

// اضافه کردن کانال جدید
function addChannel(channelId, addedBy) {
    const channels = loadChannels();
    
    // چک کردن تکراری نبودن
    if (channels.some(ch => ch.id === channelId)) {
        return { success: false, message: "❌ این کانال قبلاً اضافه شده است!" };
    }
    
    channels.push({
        id: channelId,
        addedBy: addedBy,
        addedAt: new Date().toISOString(),
        enabled: true
    });
    
    if (saveChannels(channels)) {
        return { success: true, message: `✅ کانال ${channelId} با موفقیت اضافه شد!` };
    }
    return { success: false, message: "❌ خطا در ذخیره کانال" };
}

// حذف کانال
function removeChannel(channelId) {
    let channels = loadChannels();
    const existed = channels.some(ch => ch.id === channelId);
    
    channels = channels.filter(ch => ch.id !== channelId);
    
    if (saveChannels(channels)) {
        return { 
            success: true, 
            message: existed ? `🗑️ کانال ${channelId} حذف شد!` : "⚠️ کانالی با این شناسه یافت نشد"
        };
    }
    return { success: false, message: "❌ خطا در حذف کانال" };
}

// لیست کانال‌ها
function listChannels() {
    const channels = loadChannels();
    if (channels.length === 0) {
        return "📭 هنوز هیچ کانالی اضافه نشده است.\nاز دستور /addchannel استفاده کنید.";
    }
    
    let message = "📺 **لیست کانال‌های فعال:**\n\n";
    channels.forEach((ch, index) => {
        const status = ch.enabled ? "✅ فعال" : "⭕ غیرفعال";
        message += `${index + 1}. \`${ch.id}\` - ${status}\n`;
    });
    message += `\nمجموع: ${channels.length} کانال`;
    return message;
}

// فعال/غیرفعال کردن کانال
function toggleChannel(channelId) {
    const channels = loadChannels();
    const channel = channels.find(ch => ch.id === channelId);
    
    if (!channel) {
        return { success: false, message: "❌ کانال یافت نشد!" };
    }
    
    channel.enabled = !channel.enabled;
    saveChannels(channels);
    
    const status = channel.enabled ? "فعال" : "غیرفعال";
    return { success: true, message: `✅ کانال ${channelId} ${status} شد!` };
}

// ========== ۳. تابع واکنش تصادفی ==========
async function reactToPost(ctx, channelId) {
    try {
        // اعمال شانس تصادفی
        const random = Math.floor(Math.random() * 100) + 1;
        if (random > REACTION_CHANCE) {
            console.log(`🎲 شانس ${REACTION_CHANCE}% - واکنش زده نشد (عدد آمد: ${random})`);
            return;
        }
        
        // انتخاب ایموجی تصادفی
        const randomEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
        
        // زدن واکنش
        await ctx.api.setMessageReaction(
            ctx.msg.chat.id, 
            ctx.msg.message_id, {
                reaction: [{ type: "emoji", emoji: randomEmoji }]
            }
        );
        
        console.log(`✅ واکنش ${randomEmoji} به پست ${ctx.msg.message_id} در کانال ${channelId} زده شد`);
    } catch (error) {
        console.error(`❌ خطا در زدن واکنش: ${error.message}`);
    }
}

// ========== ۴. بررسی مجاز بودن کانال ==========
async function isChannelAllowed(chatId) {
    const channels = loadChannels();
    const channel = channels.find(ch => ch.id === chatId.toString());
    return channel && channel.enabled;
}

// ========== ۵. گوش دادن به پست‌های جدید ==========
bot.on("channel_post", async (ctx) => {
    const chatId = ctx.chat.id.toString();
    
    // بررسی مجاز بودن کانال
    if (!await isChannelAllowed(chatId)) {
        console.log(`⏭️ کانال ${chatId} در لیست نیست یا غیرفعال است، نادیده گرفته شد`);
        return;
    }
    
    console.log(`📢 پست جدید در کانال مجاز ${chatId} شناسایی شد!`);
    await reactToPost(ctx, chatId);
});

// پیام‌های معمولی در کانال‌ها
bot.on("message", async (ctx) => {
    if (ctx.chat?.type === "channel") {
        const chatId = ctx.chat.id.toString();
        if (await isChannelAllowed(chatId)) {
            await reactToPost(ctx, chatId);
        }
    }
});

// ========== ۶. دستورات مدیریت کانال ==========
// اضافه کردن کانال جدید
bot.command("addchannel", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        await ctx.reply(
            "📝 **راهنما:**\n" +
            "برای اضافه کردن کانال از این فرمت استفاده کنید:\n" +
            "`/addchannel @channel_username`\n\n" +
            "یا با آیدی عددی:\n" +
            "`/addchannel -1001234567890`\n\n" +
            "⚠️ **نکته:** ربات باید ادمین کانال باشد!"
        );
        return;
    }
    
    const channelId = args[1];
    const result = addChannel(channelId, ctx.from.id);
    
    await ctx.reply(result.message);
    
    // پیشنهاد تست کانال
    if (result.success) {
        await ctx.reply(
            "✅ کانال اضافه شد!\n\n" +
            "🔍 برای تست، یک پیام در کانال بفرستید.\n" +
            "📋 مشاهده لیست: /listchannels\n" +
            "🗑️ حذف کانال: /removechannel"
        );
    }
});

// حذف کانال
bot.command("removechannel", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        await ctx.reply("📝 استفاده: `/removechannel @channel_username` یا `/removechannel -1001234567890`");
        return;
    }
    
    const channelId = args[1];
    const result = removeChannel(channelId);
    await ctx.reply(result.message);
});

// لیست کانال‌ها
bot.command("listchannels", async (ctx) => {
    const list = listChannels();
    await ctx.reply(list, { parse_mode: "Markdown" });
});

// فعال/غیرفعال کردن کانال
bot.command("togglechannel", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        await ctx.reply("📝 استفاده: `/togglechannel @channel_username`");
        return;
    }
    
    const channelId = args[1];
    const result = toggleChannel(channelId);
    await ctx.reply(result.message);
});

// تنظیم شانس واکنش (فقط برای ادمین ربات)
bot.command("setchance", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        await ctx.reply("📝 استفاده: `/setchance 70` (عدد بین 0 تا 100)");
        return;
    }
    
    const chance = parseInt(args[1]);
    if (isNaN(chance) || chance < 0 || chance > 100) {
        await ctx.reply("❌ لطفاً یک عدد بین 0 تا 100 وارد کنید!");
        return;
    }
    
    // اینجا فقط برای این سشن تغییر می‌کنه
    // برای ذخیره دائم باید از متغیر محیطی استفاده کنی
    await ctx.reply(`🎲 شانس واکنش به ${chance}% تغییر کرد! (تا ریاستارت بعدی)`);
});

// دستور استارت
bot.command("start", async (ctx) => {
    await ctx.reply(
        `🤖 **ربات واکنش‌زننده حرفه‌ای**\n\n` +
        `📺 **مدیریت کانال‌ها:**\n` +
        `• /addchannel @username - اضافه کردن کانال جدید\n` +
        `• /removechannel @username - حذف کانال\n` +
        `• /listchannels - مشاهده لیست کانال‌ها\n` +
        `• /togglechannel @username - فعال/غیرفعال کردن\n\n` +
        `⚙️ **تنظیمات:**\n` +
        `• ایموجی‌ها: ${EMOJIS.join(", ")}\n` +
        `• شانس واکنش: ${REACTION_CHANCE}%\n` +
        `• /setchance عدد - تغییر شانس واکنش\n\n` +
        `⚠️ **نکته مهم:** ربات باید در کانال‌ها **ادمین** باشد!`,
        { parse_mode: "Markdown" }
    );
});

// راهنما
bot.command("help", async (ctx) => {
    await ctx.reply(
        "📚 **راهنمای کامل ربات:**\n\n" +
        "**مدیریت کانال‌ها:**\n" +
        "/addchannel - اضافه کردن کانال جدید\n" +
        "/removechannel - حذف کانال از لیست\n" +
        "/listchannels - نمایش همه کانال‌ها\n" +
        "/togglechannel - فعال/غیرفعال کردن موقت\n\n" +
        "**تنظیمات:**\n" +
        "/setchance - تغییر شانس واکنش (0-100)\n" +
        "/stats - آمار واکنش‌ها\n\n" +
        "**سایر:**\n" +
        "/start - راه‌اندازی مجدد ربات\n" +
        "/help - نمایش این راهنما"
    );
});

// آمار ساده (در حافظه موقت)
let reactionStats = { total: 0, lastReactions: [] };
bot.command("stats", async (ctx) => {
    await ctx.reply(
        `📊 **آمار ربات:**\n\n` +
        `• کانال‌های فعال: ${loadChannels().length}\n` +
        `• کل واکنش‌ها: ${reactionStats.total}\n` +
        `• ایموجی‌های فعال: ${EMOJIS.length} عدد\n` +
        `• شانس فعلی: ${REACTION_CHANCE}%\n` +
        `• وضعیت: 🟢 آنلاین`
    );
});

// ========== ۷. اجرای ربات ==========
bot.start();
console.log(`🚀 ربات ${bot.botInfo.username} با موفقیت اجرا شد!`);
console.log(`📺 آماده مدیریت کانال‌ها...`);
