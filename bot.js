const { Bot } = require("grammy");
const fs = require("fs");

const BOT_TOKEN = process.env.BOT_TOKEN;
const EMOJIS = (process.env.EMOJIS || "❤️‍🔥,❤️,🔥,💯,🕊️").split(",");
const REACTION_CHANCE = parseInt(process.env.REACTION_CHANCE || "70");

if (!BOT_TOKEN) {
    console.error("❌ BOT_TOKEN پیدا نشد!");
    process.exit(1);
}

const bot = new Bot(BOT_TOKEN);
const CHANNELS_FILE = "channels.json";

// ========== مدیریت کانال‌ها ==========
function loadChannels() {
    try {
        if (fs.existsSync(CHANNELS_FILE)) {
            return JSON.parse(fs.readFileSync(CHANNELS_FILE, "utf8"));
        }
    } catch (error) {
        console.error("خطا در بارگذاری:", error);
    }
    return [];
}

function saveChannels(channels) {
    try {
        fs.writeFileSync(CHANNELS_FILE, JSON.stringify(channels, null, 2));
        return true;
    } catch (error) {
        console.error("خطا در ذخیره:", error);
        return false;
    }
}

function addChannel(channelId, addedBy) {
    const channels = loadChannels();
    if (channels.some(ch => ch.id === channelId)) {
        return { success: false, message: "❌ این کانال قبلاً اضافه شده!" };
    }
    channels.push({ id: channelId, addedBy, addedAt: new Date().toISOString(), enabled: true });
    saveChannels(channels);
    return { success: true, message: `✅ کانال ${channelId} اضافه شد!` };
}

function removeChannel(channelId) {
    let channels = loadChannels();
    const existed = channels.some(ch => ch.id === channelId);
    channels = channels.filter(ch => ch.id !== channelId);
    saveChannels(channels);
    return { success: true, message: existed ? `🗑️ کانال ${channelId} حذف شد!` : "⚠️ کانال یافت نشد" };
}

function listChannels() {
    const channels = loadChannels();
    if (channels.length === 0) return "📭 هیچ کانالی اضافه نشده.\nاز /addchannel استفاده کن.";
    
    let message = "📺 **لیست کانال‌ها:**\n\n";
    channels.forEach((ch, i) => {
        message += `${i+1}. \`${ch.id}\` - ${ch.enabled ? "✅ فعال" : "⭕ غیرفعال"}\n`;
    });
    return message;
}

function toggleChannel(channelId) {
    const channels = loadChannels();
    const channel = channels.find(ch => ch.id === channelId);
    if (!channel) return { success: false, message: "❌ کانال یافت نشد!" };
    channel.enabled = !channel.enabled;
    saveChannels(channels);
    return { success: true, message: `✅ کانال ${channelId} ${channel.enabled ? "فعال" : "غیرفعال"} شد!` };
}

async function isChannelAllowed(chatId) {
    const channels = loadChannels();
    const channel = channels.find(ch => ch.id === chatId.toString());
    return channel && channel.enabled;
}

// ========== تابع واکنش (اصلاح شده) ==========
let currentChance = REACTION_CHANCE;

async function reactToPost(ctx, channelId) {
    try {
        const random = Math.floor(Math.random() * 100) + 1;
        if (random > currentChance) {
            console.log(`🎲 واکنش زده نشد (شانس ${currentChance}%, آمد ${random})`);
            return;
        }
        
        const randomEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
        
        // ✅ فرمت صحیح ری اکت
        await ctx.api.setMessageReaction(
            ctx.chat.id,
            ctx.msg.message_id,
            [{ type: "emoji", emoji: randomEmoji }]
        );
        
        console.log(`✅ واکنش ${randomEmoji} به پست ${ctx.msg.message_id} در ${channelId} زده شد`);
    } catch (error) {
        console.error(`❌ خطا: ${error.message}`);
    }
}

// ========== دریافت پست‌های کانال ==========
bot.on("channel_post", async (ctx) => {
    const chatId = ctx.chat.id.toString();
    console.log(`📢 پست جدید در کانال ${chatId} دریافت شد`);
    
    if (!await isChannelAllowed(chatId)) {
        console.log(`⏭️ کانال ${chatId} مجاز نیست یا غیرفعال است`);
        return;
    }
    
    await reactToPost(ctx, chatId);
});

// ========== دستورات ==========
bot.command("start", async (ctx) => {
    await ctx.reply(
        "🤖 **ربات واکنش‌زننده کانال**\n\n" +
        "/addchannel - اضافه کردن کانال\n" +
        "/removechannel - حذف کانال\n" +
        "/listchannels - لیست کانال‌ها\n" +
        "/togglechannel - فعال/غیرفعال کردن\n" +
        "/setchance - تغییر شانس واکنش\n\n" +
        `⚙️ وضعیت: ${EMOJIS.length} ایموجی | شانس ${currentChance}%`,
        { parse_mode: "Markdown" }
    );
});

bot.command("addchannel", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        await ctx.reply("📝 استفاده: `/addchannel @channel` یا `/addchannel -1001234567890`");
        return;
    }
    const result = addChannel(args[1], ctx.from.id);
    await ctx.reply(result.message);
    
    if (result.success) {
        await ctx.reply("🔍 بعد از اضافه کردن، ربات رو دوباره استارت کن: /start\n⚠️ حتماً ربات ادمین کانال باشه!");
    }
});

bot.command("removechannel", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        await ctx.reply("📝 استفاده: `/removechannel @channel`");
        return;
    }
    await ctx.reply(removeChannel(args[1]).message);
});

bot.command("listchannels", async (ctx) => {
    await ctx.reply(listChannels(), { parse_mode: "Markdown" });
});

bot.command("togglechannel", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        await ctx.reply("📝 استفاده: `/togglechannel @channel`");
        return;
    }
    await ctx.reply(toggleChannel(args[1]).message);
});

bot.command("setchance", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        await ctx.reply("📝 استفاده: `/setchance 70` (0 تا 100)");
        return;
    }
    const chance = parseInt(args[1]);
    if (isNaN(chance) || chance < 0 || chance > 100) {
        await ctx.reply("❌ عدد بین 0 تا 100 وارد کن!");
        return;
    }
    currentChance = chance;
    await ctx.reply(`🎲 شانس واکنش به ${chance}% تغییر کرد!`);
});

bot.command("stats", async (ctx) => {
    const channels = loadChannels();
    await ctx.reply(
        `📊 **آمار:**\n\n` +
        `• کانال‌ها: ${channels.filter(c => c.enabled).length} فعال از ${channels.length}\n` +
        `• ایموجی‌ها: ${EMOJIS.length} عدد\n` +
        `• شانس فعلی: ${currentChance}%\n` +
        `• وضعیت: 🟢 آنلاین`,
        { parse_mode: "Markdown" }
    );
});

// ========== اجرا ==========
async function main() {
    try {
        await bot.api.deleteWebhook({ drop_pending_updates: true });
        console.log("✅ Webhook پاک شد");
        
        const botInfo = await bot.api.getMe();
        console.log(`🤖 ربات: @${botInfo.username}`);
        console.log(`🚀 ربات اجرا شد!`);
        console.log(`😊 ایموجی‌ها: ${EMOJIS.join(", ")}`);
        console.log(`🎲 شانس: ${currentChance}%`);
        
        bot.start();
    } catch (error) {
        console.error("❌ خطا:", error);
        process.exit(1);
    }
}

main();
