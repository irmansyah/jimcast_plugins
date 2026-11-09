// [plugin] jimcast-external-emoji-picker/src/catalog.ts
//
// Emoji catalog. Spec format: "name emoji, name emoji, ..." (underscores in
// names become spaces). Add an emoji by adding one entry; add a category with
// one `category()`.

export interface Emoji { name: string; emoji: string }
export interface Category { id: string; name: string; icon: string; emojis: Emoji[] }

const category = (id: string, name: string, icon: string, spec: string): Category => ({
  id, name, icon,
  emojis: spec.split(",").map((e) => e.trim()).filter(Boolean).map((e) => {
    const [n, emoji] = e.split(/\s+/);
    return { name: n.replace(/_/g, " "), emoji };
  }),
});

export const CATEGORIES: readonly Category[] = [
  category("smileys", "Smileys", "😀", `
    grinning 😀, smile 😄, grin 😁, joy 😂, rofl 🤣, smiling 🙂, upside_down 🙃, wink 😉, blush 😊,
    heart_eyes 😍, kiss 😘, yum 😋, tongue 😛, zany 🤪, thinking 🤔, shushing 🤫, hugging 🤗,
    saluting 🫡, melting 🫠, neutral 😐, expressionless 😑, unamused 😒, roll_eyes 🙄, smirk 😏,
    relieved 😌, pensive 😔, sleepy 😪, sleeping 😴, mask 😷, nerd 🤓, sunglasses 😎, partying 🥳,
    hot 🥵, cold 🥶, exploding_head 🤯, flushed 😳, pleading 🥺, cry 😢, sob 😭, scream 😱,
    angry 😠, rage 😡, skull 💀, clown 🤡, ghost 👻, alien 👽, robot 🤖, poop 💩`),
  category("gestures", "Gestures", "👍", `
    thumbs_up 👍, thumbs_down 👎, ok 👌, victory ✌️, crossed_fingers 🤞, love_you 🤟, metal 🤘,
    call_me 🤙, point_left 👈, point_right 👉, point_up 👆, point_down 👇, wave 👋, raised_hand ✋,
    clap 👏, raised_hands 🙌, open_hands 👐, pray 🙏, handshake 🤝, muscle 💪, writing ✍️, fist 👊,
    raised_fist ✊, pinching 🤏, eyes 👀, brain 🧠, ear 👂, nose 👃, mouth 👄, tongue_out 👅`),
  category("animals", "Nature", "🐶", `
    dog 🐶, cat 🐱, mouse 🐭, hamster 🐹, rabbit 🐰, fox 🦊, bear 🐻, panda 🐼, koala 🐨, tiger 🐯,
    lion 🦁, cow 🐮, pig 🐷, frog 🐸, monkey 🐵, see_no_evil 🙈, chicken 🐔, penguin 🐧, bird 🐦,
    owl 🦉, bat 🦇, wolf 🐺, horse 🐴, unicorn 🦄, bee 🐝, bug 🐛, butterfly 🦋, snail 🐌, ladybug 🐞,
    ant 🐜, spider 🕷️, scorpion 🦂, turtle 🐢, snake 🐍, lizard 🦎, octopus 🐙, squid 🦑, crab 🦀,
    fish 🐟, dolphin 🐬, whale 🐳, shark 🦈, crocodile 🐊, elephant 🐘, giraffe 🦒, camel 🐫,
    sheep 🐑, flower 🌸, rose 🌹, sunflower 🌻, tree 🌳, palm 🌴, cactus 🌵, leaf 🍃, mushroom 🍄`),
  category("food", "Food", "🍔", `
    apple 🍎, banana 🍌, grapes 🍇, strawberry 🍓, lemon 🍋, peach 🍑, cherries 🍒, pineapple 🍍,
    avocado 🥑, tomato 🍅, carrot 🥕, corn 🌽, pepper 🌶️, bread 🍞, croissant 🥐, cheese 🧀, egg 🥚,
    bacon 🥓, burger 🍔, fries 🍟, pizza 🍕, hotdog 🌭, sandwich 🥪, taco 🌮, burrito 🌯, ramen 🍜,
    spaghetti 🍝, sushi 🍣, curry 🍛, rice 🍚, dumpling 🥟, cake 🎂, cupcake 🧁, donut 🍩, cookie 🍪,
    chocolate 🍫, candy 🍬, ice_cream 🍦, popcorn 🍿, coffee ☕, tea 🍵, beer 🍺, beers 🍻, wine 🍷,
    cocktail 🍸, champagne 🍾, milk 🥛, water 💧`),
  category("activity", "Activity", "⚽", `
    soccer ⚽, basketball 🏀, football 🏈, baseball ⚾, tennis 🎾, volleyball 🏐, ping_pong 🏓,
    golf ⛳, boxing 🥊, bowling 🎳, dart 🎯, video_game 🎮, joystick 🕹️, dice 🎲, chess ♟️,
    puzzle 🧩, trophy 🏆, medal 🏅, first_place 🥇, guitar 🎸, piano 🎹, drum 🥁, microphone 🎤,
    headphones 🎧, clapper 🎬, art 🎨, party 🎉, confetti 🎊, balloon 🎈, gift 🎁, ticket 🎫`),
  category("travel", "Travel", "🚗", `
    car 🚗, taxi 🚕, bus 🚌, truck 🚚, bike 🚲, scooter 🛴, motorcycle 🏍️, train 🚆, plane ✈️,
    rocket 🚀, helicopter 🚁, ship 🚢, boat ⛵, anchor ⚓, house 🏠, office 🏢, hospital 🏥, bank 🏦,
    school 🏫, castle 🏰, tent ⛺, mountain ⛰️, volcano 🌋, beach 🏖️, island 🏝️, sunrise 🌅,
    city 🌆, night 🌃, bridge 🌉, earth 🌍, map 🗺️, compass 🧭, sun ☀️, moon 🌙, cloud ☁️,
    rain 🌧️, snow ❄️, rainbow 🌈, lightning ⚡`),
  category("objects", "Objects", "💡", `
    phone 📱, laptop 💻, desktop 🖥️, keyboard ⌨️, mouse_device 🖱️, cd 💿, floppy 💾, camera 📷,
    video_camera 📹, tv 📺, radio 📻, battery 🔋, plug 🔌, bulb 💡, flashlight 🔦, candle 🕯️,
    money 💰, dollar 💵, credit_card 💳, gem 💎, wrench 🔧, hammer 🔨, gear ⚙️, toolbox 🧰,
    magnet 🧲, link 🔗, paperclip 📎, pushpin 📌, scissors ✂️, lock 🔒, key 🔑, bell 🔔, book 📖,
    books 📚, notebook 📓, memo 📝, pencil ✏️, calendar 📅, chart 📊, clipboard 📋, folder 📁,
    inbox 📥, package 📦, mail ✉️, email 📧, microscope 🔬, telescope 🔭, pill 💊, syringe 💉,
    hourglass ⌛, alarm ⏰`),
  category("symbols", "Symbols", "❤️", `
    red_heart ❤️, orange_heart 🧡, yellow_heart 💛, green_heart 💚, blue_heart 💙, purple_heart 💜,
    black_heart 🖤, broken_heart 💔, sparkling_heart 💖, fire 🔥, hundred 💯, sparkles ✨, star ⭐,
    glowing_star 🌟, boom 💥, zzz 💤, speech 💬, thought 💭, check ✅, cross ❌, warning ⚠️,
    no_entry ⛔, prohibited 🚫, question ❓, exclamation ❗, plus ➕, minus ➖, arrow_right ➡️,
    arrow_left ⬅️, arrow_up ⬆️, arrow_down ⬇️, refresh 🔄, recycle ♻️, infinity ♾️, new 🆕,
    ok_button 🆗, cool 🆒, free 🆓, sos 🆘, top 🔝, soon 🔜, red_circle 🔴, green_circle 🟢,
    blue_circle 🔵, yellow_circle 🟡, white_square ⬜, black_square ⬛`),
];

export const RECENT_ID = "recent";
export const COLUMNS = 12;

export const allEmojis = (): Emoji[] => CATEGORIES.flatMap((c) => c.emojis);

export const nameOf = new Map<string, string>(
  CATEGORIES.flatMap((c) => c.emojis.map((e) => [e.emoji, e.name] as const)),
);

// ── Tabs ────────────────────────────────────────────────────────────────────
export interface Tab { id: string; name: string; icon: string }

export const tabList = (): Tab[] => [
  { id: RECENT_ID, name: "Recent", icon: "🕘" },
  ...CATEGORIES.map((c) => ({ id: c.id, name: c.name, icon: c.icon })),
];

export function findTab(q: string): Tab | undefined {
  const s = q.toLowerCase();
  return tabList().find((t) => t.id === s || t.name.toLowerCase() === s);
}
