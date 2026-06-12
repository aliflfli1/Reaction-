const { Bot } = require("grammy");
const fs = require("fs");

// ========== ۱. تنظیمات اولیه ==========
const BOT_TOKEN = process.env.BOT_TOKEN;
const EMOJIS = (process.env.EMOJIS || "👍,❤️,🔥,🥰,👏").split(",");
const REACTION_CHANCE = parseInt(process.env.REACTION_CHANCE || "70");

if (!BOT_TOKEN) {
    console.error("❌ BOT_TOKEN پیدا نشد! متغیر محیطی را تنظیم کنید.");
    process.exit(1);
}

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

function addChannel(channelId, addedBy) {
    const channels = loadChannels();
    
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

async function isChannelAllowed(chatId) {
    const channels = loadChannels();
    const channel = channels.find(ch => ch.id === chatId.toString());
    return channel && channel.enabled;
}

// ========== ۳. تابع واکنش تصادفی ==========
let currentChance = REACTION_CHANCE;

async function reactToPost(ctx, channelId) {
    try {
        const random = Math.floor(Math.random() * 100) + 1;
        if (random > currentChance) {
            console.log(`🎲 شانس ${currentChance}% - واکنش زده نشد (عدد آمد: ${random})`);
            return;
        }
        
        const randomEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
        
        await ctx.api.setMessageReaction(
            ctx.msg.chat.id, 
            ctx.msg.message_id, 
            [{ type: "emoji", emoji: randomEmoji }]
        );
        
        console.log(`✅ واکنش ${randomEmoji} به پست ${ctx.msg.message_id} در کانال ${channelId} زده شد`);
    } catch (error) {
        console.error(`❌ خطا در زدن واکنش: ${error.message}`);
    }
}

// ========== ۴. مدیریت پیام‌های کانال ==========
bot.on("channel_post", async (ctx) => {
    const chatId = ctx.chat.id.toString();
    
    if (!await isChannelAllowed(chatId)) {
        console.log(`⏭️ کانال ${chatId} در لیست نیست یا غیرفعال است، نادیده گرفته شد`);
        return;
    }
    
    console.log(`📢 پست جدید در کانال ${chatId} شناسایی شد!`);
    await reactToPost(ctx, chatId);
});

// ========== ۵. دستورات ربات ==========
bot.command("start", async (ctx) => {
    await ctx.reply(
        `🤖 **ربات واکنش‌زننده کانال**\n\n` +
        `📺 **مدیریت کانال‌ها:**\n` +
        `• /addchannel @username - اضافه کردن کانال\n` +
        `• /removechannel @username - حذف کانال\n` +
        `• /listchannels - مشاهده لیست کانال‌ها\n` +
        `• /togglechannel @username - فعال/غیرفعال کردن\n\n` +
        `⚙️ **تنظیمات:**\n` +
        `• ایموجی‌ها: ${EMOJIS.join(", ")}\n` +
        `• شانس واکنش: ${currentChance}%\n` +
        `• /setchance عدد - تغییر شانس\n\n` +
        `⚠️ **نکته:** ربات باید در کانال **ادمین** باشد!`,
        { parse_mode: "Markdown" }
    );
});

bot.command("help", async (ctx) => {
    await ctx.reply(
        "📚 **راهنما:**\n\n" +
        "/addchannel - اضافه کردن کانال جدید\n" +
        "/removechannel - حذف کانال\n" +
        "/listchannels - نمایش همه کانال‌ها\n" +
        "/togglechannel - فعال/غیرفعال کردن\n" +
        "/setchance - تغییر شانس واکنش (0-100)\n" +
        "/stats - آمار ربات\n" +
        "/start - راه‌اندازی مجدد"
    );
});

bot.command("addchannel", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        await ctx.reply(
            "📝 **راهنما:**\n" +
            "استفاده: `/addchannel @channel_username`\n\n" +
            "یا با آیدی عددی: `/addchannel -1001234567890`\n\n" +
            "⚠️ ربات باید ادمین کانال باشد!"
        );
        return;
    }
    
    const channelId = args[1];
    const result = addChannel(channelId, ctx.from.id);
    await ctx.reply(result.message);
});

bot.command("removechannel", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        await ctx.reply("📝 استفاده: `/removechannel @channel_username`");
        return;
    }
    
    const channelId = args[1];
    const result = removeChannel(channelId);
    await ctx.reply(result.message);
});

bot.command("listchannels", async (ctx) => {
    const list = listChannels();
    await ctx.reply(list, { parse_mode: "Markdown" });
});

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
    
    currentChance = chance;
    await ctx.reply(`🎲 شانس واکنش به ${chance}% تغییر کرد!`);
});

bot.command("stats", async (ctx) => {
    const channels = loadChannels();
    const activeChannels = channels.filter(ch => ch.enabled).length;
    
    await ctx.reply(
        `📊 **آمار ربات:**\n\n` +
        `• کانال‌های فعال: ${activeChannels} از ${channels.length}\n` +
        `• ایموجی‌ها: ${EMOJIS.length} عدد\n` +
        `• شانس فعلی: ${currentChance}%\n` +
        `• وضعیت: 🟢 آنلاین`,
        { parse_mode: "Markdown" }
    );
});

// ========== ۶. اجرای ربات ==========
async function main() {
    try {
        // پاک کردن webhook
        await bot.api.deleteWebhook({ drop_pending_updates: true });
        console.log("✅ Webhook پاک شد");
        
        // دریافت اطلاعات ربات
        const botInfo = await bot.api.getMe();
        console.log(`🤖 ربات: @${botInfo.username}`);
        console.log(`🚀 ربات با موفقیت اجرا شد!`);
        console.log(`📺 آماده مدیریت کانال‌ها...`);
        console.log(`😊 ایموجی‌ها: ${EMOJIS.join(", ")}`);
        console.log(`🎲 شانس واکنش: ${currentChance}%`);
        
        // شروع polling
        bot.start();
        
    } catch (error) {
        console.error("❌ خطا در اجرای ربات:", error);
        process.exit(1);
    }
}

main();
