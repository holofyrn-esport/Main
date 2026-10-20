const BRAND = require("../config/brand");
const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType,
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'rulesMessage.json');

function loadRulesData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
            fs.writeFileSync(DATA_FILE, '{}', 'utf8');
            return {};
        }

        const content = fs.readFileSync(DATA_FILE, 'utf8').trim();

        if (!content) {
            return {};
        }

        return JSON.parse(content);
    } catch (error) {
        console.error('Failed to load rulesMessage.json:', error);
        return {};
    }
}

function saveRulesData(data) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function normalizeChannelName(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]/g, "");
}

function channelMention(guild, channelNames) {
    const names = Array.isArray(channelNames)
        ? channelNames
        : [channelNames];

    const normalizedNames = names.map(normalizeChannelName);

    const channel = guild.channels.cache.find((item) => {
        if (
            item.type !== ChannelType.GuildText &&
            item.type !== ChannelType.GuildAnnouncement
        ) {
            return false;
        }

        const normalizedChannel = normalizeChannelName(item.name);

        return normalizedNames.some((name) =>
            normalizedChannel === name ||
            normalizedChannel.includes(name) ||
            name.includes(normalizedChannel)
        );
    });

    return channel
        ? `<#${channel.id}>`
        : `#${names[names.length - 1]}`;
}

function buildRulesEmbeds(guild) {
    const rankVerification = channelMention(
        guild,
        ['🎟️rank-verification', 'rank-verification'],
    );

    const rolesChannel = channelMention(
        guild,
        ['roles'],
    );

    const faRegistration = channelMention(
        guild,
        [
            'fa-tryout-registration',
            '🎮fa-tryout-registration',
            '📝fa-tryout-registration',
        ],
    );

    const tournaments = channelMention(
        guild,
        ['🏆tournaments', 'tournaments'],
    );

    const selfPromo = channelMention(
        guild,
        ['📈self-promo', 'self-promo'],
    );

    const rulesEmbed = new EmbedBuilder()
        .setColor(BRAND.color)
        .setTitle('📜 Welcome to HoloFyrn Esports')
        .setDescription(
            [
                'Welcome to **HoloFyrn Esports!**',
                '',
                'This server is a place to find teammates, discover Rocket League tournaments, improve your gameplay, and connect with the community.',
                '',
                'Please read and follow the rules below.',
            ].join('\n'),
        )
        .addFields(
            {
                name: '🤝 Respect Everyone',
                value: [
                    '• Treat all members with respect.',
                    '• No harassment, discrimination, or personal attacks.',
                    '• Friendly banter is welcome, but know where the line is.',
                ].join('\n'),
            },
            {
                name: '💬 Keep Chats Organized',
                value: [
                    '• Use channels for their intended purpose.',
                    '• Avoid spam, excessive pinging, and message flooding.',
                    '• Keep conversations relevant to each channel.',
                ].join('\n'),
            },
            {
                name: '🚫 No Toxicity',
                value: [
                    '• Keep discussions civil and constructive.',
                    '• Do not intentionally ruin another member’s experience.',
                    '• Do not start unnecessary arguments or drama.',
                ].join('\n'),
            },
        );

    const rolesEmbed = new EmbedBuilder()
        .setColor(BRAND.color)
        .setTitle('🏅 Roles, Verification and Tryouts')
        .addFields(
            {
                name: '🏅 Rank Verification',
                value:
                    `To receive your Rocket League rank roles, head over to ${rankVerification} and follow the instructions.`,
            },
            {
                name: '🔔 Tournament Notifications',
                value:
                    `Head over to ${rolesChannel} and use the Tournament role button to be notified when new tournaments are posted.`,
            },
            {
                name: '🎮 Free Agent Registration',
                value: [
                    'Members who are looking for a team should collect the **FA | Free Agent** role from the self-role panel.',
                    '',
                    `After receiving the role, head over to ${faRegistration} and submit your tryout application.`,
                    '',
                    'Your application will be reviewed by the appropriate HoloFyrn captain or staff team.',
                ].join('\n'),
            },
        );

    const tournamentsEmbed = new EmbedBuilder()
        .setColor(BRAND.color)
        .setTitle('🏆 Tournaments')
        .setDescription(
            [
                `${tournaments} contains upcoming Rocket League tournaments reposted from different organizers.`,
                '',
                '**Tournament posts may contain:**',
                '📅 Date',
                '🕒 Time',
                '🎮 Format',
                '🔗 Registration',
                '📝 Additional notes',
                '',
                'Use the **🔎 Find me a teammate** button underneath a tournament post when you need someone to play with.',
                '',
                `Remember to get the notification role from ${rolesChannel} so you do not miss new tournament posts.`,
            ].join('\n'),
        );

    const communityEmbed = new EmbedBuilder()
        .setColor(BRAND.color)
        .setTitle('🤝 Community Information')
        .addFields(
            {
                name: '📢 Self-Promotion',
                value:
                    `Advertise yourself only in ${selfPromo}. Do not advertise in other channels.`,
            },
            {
                name: '🤝 Partnerships',
                value:
                    process.env.PARTNERSHIP_CONTACT_USER_ID
                        ? `For partnership enquiries, send a direct message to <@${process.env.PARTNERSHIP_CONTACT_USER_ID}>.`
                        : 'For partnership enquiries, contact the HoloFyrn staff team.',
            },
        )
        .setFooter({
            text: 'Thanks for being part of HoloFyrn Esports. Good luck and have fun!',
        });

    return [
        rulesEmbed,
        rolesEmbed,
        tournamentsEmbed,
        communityEmbed,
    ];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rules')
        .setDescription('Manage the server rules message')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setup')
                .setDescription('Post or update the server rules'),
        ),

    async execute(interaction) {
        if (!interaction.inGuild() || !interaction.guild) {
            return interaction.reply({
                content: 'This command can only be used inside a server.',
                ephemeral: true,
            });
        }

        if (!interaction.channel || !interaction.channel.isTextBased()) {
            return interaction.reply({
                content: 'Please use this command in a text channel.',
                ephemeral: true,
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const embeds = buildRulesEmbeds(interaction.guild);
            const savedData = loadRulesData();

            let rulesMessage = null;
            let resultText = '';

            if (savedData.channelId && savedData.messageId) {
                try {
                    const oldChannel = await interaction.guild.channels.fetch(
                        savedData.channelId,
                    );

                    if (oldChannel?.isTextBased()) {
                        rulesMessage = await oldChannel.messages.fetch(
                            savedData.messageId,
                        );

                        await rulesMessage.edit({
                            embeds,
                        });

                        resultText = `✅ The existing rules message was updated in <#${oldChannel.id}>.`;
                    }
                } catch (error) {
                    console.log(
                        'The old rules message could not be found. A new one will be created.',
                    );
                }
            }

            if (!rulesMessage) {
                rulesMessage = await interaction.channel.send({
                    embeds,
                });

                saveRulesData({
                    guildId: interaction.guild.id,
                    channelId: interaction.channel.id,
                    messageId: rulesMessage.id,
                });

                resultText = `✅ The rules were posted in <#${interaction.channel.id}>.`;
            }

            await interaction.editReply({
                content: resultText,
            });
        } catch (error) {
            console.error('Rules command error:', error);

            await interaction.editReply({
                content:
                    '❌ I could not post the rules. Check the bot permissions and the Command Prompt for the full error.',
            });
        }
    },
};
