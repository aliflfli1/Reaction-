require("dotenv").config();
const { Bot } = require("grammy");

const bot = new Bot(process.env.BOT_TOKEN);

const EMOJIS = ["👍", "❤️", "🔥", "😍", "👏"];

bot.on("channel_post", async (ctx) => {
    try {
        const emoji =
            EMOJIS[Math.floor(Math.random() * EMOJIS.length)];

        await ctx.api.setMessageReaction(
            ctx.chat.id,
            ctx.msg.message_id,
            [{ type: "emoji", emoji }]
        );

        console.log(
            `✅ ${emoji} -> ${ctx.chat.id} | ${ctx.msg.message_id}`
        );
    } catch (err) {
        console.error("❌ Error:", err.description || err.message);
    }
});

bot.command("start", async (ctx) => {
    await ctx.reply(
        "🤖 ربات واکنش‌زن فعال است.\n\nربات را ادمین کانال کن و اجازه Reaction بده."
    );
});

(async () => {
    try {
        await bot.init();

        console.log(`🚀 @${bot.botInfo.username} Started`);

        await bot.start();
    } catch (err) {
        console.error(err);
    }
})();
