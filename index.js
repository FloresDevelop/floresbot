const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require('discord.js');

// =====================
// DOPLŇ SVÉ ÚDAJE
// =====================
const TOKEN = 'MTM4Njc4ODE5NDU0NDI1NTA3Ng.GIqDnh.ZbYZlWlK9NtXZSw0mMWEfRQ_yRdKUfO24fQGvw';                 // Bot token z Developer Portalu
const ROLE_ID = '1442141755804876909'; // ID role, kterou má pingnout

// Cooldown: channelId -> timestamp posledního použití (ms)
const cooldowns = new Map();
const COOLDOWN_MS = 30 * 1000; // 30 sekund

// Poslední vysílačková zpráva v každém kanálu
const lastVysilackaMessages = new Map();

// Helper na generování frekvence 100.xx – 999.xx
function generateFrequency() {
  const main = Math.floor(Math.random() * 900) + 100; // 100–999
  const decimal = Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, '0'); // 00–99
  return `${main}.${decimal}`;
}

// =====================
// CLIENT
// =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// =====================
// READY
// =====================
client.once('ready', () => {
  console.log(`Přihlášen jako ${client.user.tag}`);
});

// =====================
// MESSAGE COMMAND (!vysilacka)
// =====================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  if (message.content.toLowerCase() === '!vysilacka') {
    try {
      // smažeme starou vysílačku v tomhle kanálu
      const lastMsg = lastVysilackaMessages.get(message.channel.id);
      if (lastMsg) {
        try {
          await lastMsg.delete();
        } catch (e) {
          console.warn('Nepodařilo se smazat starou vysílačku:', e.message);
        }
      }

      // počáteční frekvence
      const freq1 = generateFrequency();
      const freq2 = generateFrequency();

      const embed = new EmbedBuilder()
        .setTitle('📻 Vysílačka')
        .setDescription('Stiskni tlačítko pro změnu jedné z frekvencí.')
        .setColor(0x5865f2)
        .addFields(
          { name: 'Frekvence 1', value: `**${freq1}**`, inline: true },
          { name: 'Frekvence 2', value: `**${freq2}**`, inline: true },
        );

      const button1 = new ButtonBuilder()
        .setCustomId('vysilacka_generate_1')
        .setLabel('Změnit frekvenci 1')
        .setStyle(ButtonStyle.Danger);

      const button2 = new ButtonBuilder()
        .setCustomId('vysilacka_generate_2')
        .setLabel('Změnit frekvenci 2')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(button1, button2);

      // 🔔 SHADOW PING při vytvoření vysílačky
      const pingMsg = await message.channel.send({
        content: `<@&${ROLE_ID}> Nová vysílačka (F1 + F2).`,
        allowedMentions: { roles: [ROLE_ID] },
      });

      setTimeout(() => {
        pingMsg.delete().catch(() => {});
      }, 2000); // smažeme ping po 2 vteřinách

      // hlavní zpráva vysílačky (bez pingu, ta zůstává)
      const sent = await message.channel.send({
        content: 'Vysílačka připravena.',
        embeds: [embed],
        components: [row],
      });

      lastVysilackaMessages.set(message.channel.id, sent);
    } catch (err) {
      console.error(err);
      message.reply('Něco se pokazilo při vytváření vysílačky 😢');
    }
  }
});

// =====================
// INTERAKCE – TLAČÍTKA
// =====================
client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.isButton()) return;

    if (
      interaction.customId === 'vysilacka_generate_1' ||
      interaction.customId === 'vysilacka_generate_2'
    ) {
      const now = Date.now();
      const lastUse = cooldowns.get(interaction.channelId) || 0;
      const diff = now - lastUse;

      // COOLDOWN
      if (diff < COOLDOWN_MS) {
        const remaining = Math.ceil((COOLDOWN_MS - diff) / 1000);
        return interaction.reply({
          content: `⏳ Vysílačku v tomhle kanálu můžeš použít znovu za **${remaining} s**.`,
          ephemeral: true,
        });
      }

      cooldowns.set(interaction.channelId, now);

      // nový kód
      const newFreq = generateFrequency();

      // upravíme embed
      const oldEmbed = interaction.message.embeds[0];
      if (!oldEmbed) {
        return interaction.reply({
          content: 'Nemůžu najít původní frekvence 😢',
          ephemeral: true,
        });
      }

      const embed = EmbedBuilder.from(oldEmbed);
      const fields = [...(oldEmbed.fields ?? [])];

      let which = '';
      if (interaction.customId === 'vysilacka_generate_1') {
        fields[0] = { ...fields[0], value: `**${newFreq}**` };
        which = '1';
      } else {
        fields[1] = { ...fields[1], value: `**${newFreq}**` };
        which = '2';
      }

      embed.setFields(fields);

      // 🔄 UPDATE hlavní zprávy – viditelně napíšeme, co se změnilo
      await interaction.update({
        content: `Frekvence **${which}** byla změněna na **${newFreq}**.`,
        embeds: [embed],
        components: interaction.message.components,
      });

      // 🔔 SHADOW PING – jen ping role, zpráva se smaže
      const pingMsg = await interaction.channel.send({
        content: `<@&${ROLE_ID}>`,
        allowedMentions: { roles: [ROLE_ID] },
      });

      setTimeout(() => {
        pingMsg.delete().catch(() => {});
      }, 2000); // smažeme ping po 2 vteřinách
    }
  } catch (err) {
    console.error(err);
    if (!interaction.replied && !interaction.deferred) {
      interaction.reply({
        content: 'Něco se pokazilo 😢',
        ephemeral: true,
      });
    }
  }
});

// =====================
// START BOT
// =====================
client.login(TOKEN);
