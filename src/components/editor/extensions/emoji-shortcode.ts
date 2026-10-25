import { Extension, InputRule } from "@tiptap/core";

/**
 * Emoji shortcodes — the only way to insert emoji in text (per spec):
 * `:smile:` → 😄, `:fire:` → 🔥, `:tada:` → 🎉 …
 */

export const EMOJI_SHORTCODES: Record<string, string> = {
  smile: "😄", smiley: "😃", grin: "😁", laugh: "😆", joy: "😂", rofl: "🤣",
  wink: "😉", blush: "😊", heart_eyes: "😍", "star-struck": "🤩", cool: "😎",
  thinking: "🤔", hug: "🤗", cry: "😭", sob: "😢", scream: "😱", rage: "😤",
  explode: "🤯", party: "🥳", innocent: "😇", ghost: "👻", robot: "🤖",
  wave: "👋", ok: "👌", peace: "✌️", crossfingers: "🤞", clap: "👏",
  pray: "🙏", muscle: "💪", eyes: "👀", point_up: "👆", point_right: "👉",
  thumbsup: "👍", "+1": "👍", thumbsdown: "👎", "-1": "👎",
  bulb: "💡", pin: "📌", clip: "📎", memo: "📝", pencil: "✏️", books: "📚",
  bookmark: "🔖", target: "🎯", rocket: "🚀", fire: "🔥", star: "⭐",
  sparkles: "✨", gem: "💎", trophy: "🏆", gift: "🎁", bell: "🔔",
  key: "🔑", wrench: "🛠️", gear: "⚙️", puzzle: "🧩", speech: "💬",
  chart: "📊", calendar: "📅", seedling: "🌱", tree: "🌳", blossom: "🌸",
  clover: "🍀", rainbow: "🌈", sun: "☀️", moon: "🌙", snowflake: "❄️",
  wave_ocean: "🌊", butterfly: "🦋", bee: "🐝", fox: "🦊", penguin: "🐧",
  check: "✅", checkbox: "☑️", cross: "❌", warning: "⚠️", forbidden: "🚫",
  question: "❓", exclamation: "❗", plus: "➕", minus: "➖", recycle: "♻️",
  lock: "🔒", link: "🔗", hundred: "💯", red_circle: "🔴", green_circle: "🟢",
  purple_heart: "💜", heart: "❤️", blue_heart: "💙", green_heart: "💚",
  yellow_heart: "💛", orange_heart: "🧡", black_heart: "🖤", white_heart: "🤍",
  coffee: "☕", tea: "🍵", pizza: "🍕", cake: "🍰", cookie: "🍪",
  dog: "🐶", cat: "🐱", mouse: "🐭", panda: "🐼", unicorn: "🦄",
  zap: "⚡", boom: "💥", comet: "☄️", tornado: "🌪️",
  clock: "🕐", hourglass: "⏳", alarm: "⏰", mailbox: "📬",
  folder: "📁", floppy: "💾", computer: "💻", phone: "📱", camera: "📷",
  headphones: "🎧", mic: "🎤", music: "🎵", note: "🎶",
  money: "💰", coin: "🪙", credit_card: "💳", diamond: "🔸",
  flag: "🏁", ship: "🚢", plane: "✈️", car: "🚗", house: "🏠",
  office: "🏢", hospital: "🏥", school: "🏫", church: "⛪",
  praying: "🙏", sunglasses: "😎",
};

export const EmojiShortcode = Extension.create({
  name: "emojiShortcode",

  addInputRules() {
    // `:name:` including any leading boundary whitespace (kept in output).
    return [
      new InputRule({
        find: /(?:^|\s):([a-z_+\-0-9]+):$/,
        handler: ({ state, range, match, commands }) => {
          const code = match[1];
          const emoji = EMOJI_SHORTCODES[code];
          if (!emoji) return;
          const hadBoundary = match[0].startsWith(" ") || match[0].startsWith("\u00a0");
          void state;
          commands.command(({ tr }) => {
            const text = (hadBoundary ? " " : "") + emoji;
            tr.insertText(text, range.from, range.to);
            tr.scrollIntoView();
            return true;
          });
        },
      }),
    ];
  },
});
