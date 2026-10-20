const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder
} = require("discord.js");

const {
    handleTryoutButton
} = require("../buttons/tryoutButtons");

const {
    handleTryoutSelect
} = require("../selectMenus/tryoutSelect");

const {
    loadTryouts,
    saveTryouts,
    generateTryoutId,
    findPendingApplication,
    findTryout
} = require("../utils/tryoutData");

const {
    getTryoutTeam,
    canReviewTryout
} = require("../utils/tryoutTeams");


/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */
function buildTryoutDmCard({
    accepted,
    application,
    reviewer,
    reason = null
}) {
    const accentColor = accepted
        ? 0x2ecc71
        : 0xe74c3c;

    const statusTitle = accepted
        ? "✅ Tryout Application Accepted!"
        : "❌ Tryout Application Declined";

    const introText = accepted
        ? "Congratulations! Your application to join **HoloFyrn Esports Academy** has been accepted."
        : "Thank you for your interest in joining **HoloFyrn Esports Academy**. After reviewing your application, we have decided not to proceed with your tryout at this time.";

    const closingText = accepted
        ? "Good luck with your tryout. **In ashes we rise.** 🔥"
        : "We appreciate your interest in HoloFyrn Esports and wish you the best moving forward.";

    const container = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## ${statusTitle}\n\n${introText}`
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**APPLICATION ID**\n${application.id}\n\n` +
                `**REVIEWED BY**\n${reviewer}`
            )
        );

    if (accepted) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### NEXT STEP\n` +
                "You will now be contacted by our staff regarding your tryout and the next steps in the process."
            )
        );
    } else if (reason) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### REASON\n${reason}`
            )
        );
    }

    const date = new Intl.DateTimeFormat(
        "en-GB"
    ).format(new Date());

    container
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                closingText
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `-# HOLOFYRN ESPORTS • RECRUITMENT • ${date}`
            )
        );

    return container;
}

function cleanText(value) {
    return String(value || "").trim();
}

function validTrackerUrl(value) {
    try {
        const url = new URL(value);

        return (
            url.protocol === "https:" &&
            (
                url.hostname === "rocketleague.tracker.network" ||
                url.hostname.endsWith(
                    ".rocketleague.tracker.network"
                )
            )
        );
    } catch {
        return false;
    }
}

function buildReviewButtons(applicationId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(
                `tryout_accept:${applicationId}`
            )
            .setLabel("Accept")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId(
                `tryout_decline:${applicationId}`
            )
            .setLabel("Decline")
            .setEmoji("❌")
            .setStyle(ButtonStyle.Danger)
    );
}

function buildBaseApplicationEmbed(application) {
    const embed = new EmbedBuilder()
        .setDescription(
            `Application for **${application.teamName}**`
        )
        .addFields(
            {
                name: "Applicant",
                value:
                    `<@${application.userId}>\n` +
                    application.username,
                inline: true
            },
            {
                name: "Player name",
                value: application.playerName,
                inline: true
            },
            {
                name: "Age",
                value: String(application.age),
                inline: true
            },
            {
                name: "Country and residence",
                value: application.location,
                inline: false
            },
            {
                name: "Availability",
                value: application.availability,
                inline: false
            },
            {
                name: "RL Tracker",
                value:
                    `[Open Tracker Profile](${application.tracker})`,
                inline: false
            }
        )
        .setFooter({
            text: `Application ID: ${application.id}`
        });

    if (application.teamLogoUrl) {
        embed.setThumbnail(application.teamLogoUrl);
    }

    return embed;
}

function buildPendingEmbed(application) {
    return buildBaseApplicationEmbed(application)
        .setColor(0xf1c40f)
        .setTitle(
            `Pending Tryout Application • ${application.id}`
        )
        .addFields({
            name: "Status",
            value: "🟡 Pending review",
            inline: false
        })
        .setTimestamp(
            new Date(application.submittedAt)
        );
}

function buildAcceptedEmbed(application) {
    return buildBaseApplicationEmbed(application)
        .setColor(0x2ecc71)
        .setTitle(
            `Accepted Tryout Application • ${application.id}`
        )
        .addFields({
            name: "Status",
            value:
                `🟢 Accepted by <@${application.reviewedBy}> (${application.reviewedByName || "Unknown reviewer"})`,
            inline: false
        })
        .setTimestamp(
            new Date(application.reviewedAt)
        );
}

function buildDeclinedEmbed(application) {
    return buildBaseApplicationEmbed(application)
        .setColor(0xe74c3c)
        .setTitle(
            `Declined Tryout Application • ${application.id}`
        )
        .addFields(
            {
                name: "Status",
                value:
                    `🔴 Declined by <@${application.reviewedBy}> (${application.reviewedByName || "Unknown reviewer"})`,
                inline: false
            },
            {
                name: "Reason",
                value: application.declineReason,
                inline: false
            }
        )
        .setTimestamp(
            new Date(application.reviewedAt)
        );
}

async function fetchReviewChannel(
    client,
    channelId
) {
    if (!channelId) {
        return null;
    }

    try {
        const channel =
            await client.channels.fetch(channelId);

        if (!channel?.isTextBased()) {
            return null;
        }

        return channel;
    } catch (error) {
        console.error(
            "Failed to fetch tryout review channel:",
            error
        );

        return null;
    }
}

async function fetchReviewMessage(
    interaction,
    application
) {
    if (
        interaction.message &&
        interaction.message.id ===
            application.reviewMessageId
    ) {
        return interaction.message;
    }

    const reviewChannel =
        await fetchReviewChannel(
            interaction.client,
            application.reviewChannelId
        );

    if (!reviewChannel) {
        return null;
    }

    try {
        return await reviewChannel.messages.fetch(
            application.reviewMessageId
        );
    } catch (error) {
        console.error(
            "Failed to fetch tryout review message:",
            error
        );

        return null;
    }
}

async function sendApplicantDm(
    client,
    userId,
    message
) {
    try {
        const user =
            await client.users.fetch(userId);

        await user.send(message);
        return true;
    } catch (error) {
        console.log(
            `Could not DM applicant ${userId}:`,
            error.message
        );

        return false;
    }
}


/* -------------------------------------------------------------------------- */
/* Application submission                                                     */
/* -------------------------------------------------------------------------- */

async function handleApplicationModal(interaction) {
    if (!interaction.isModalSubmit()) {
        return false;
    }

    if (
        !interaction.customId.startsWith(
            "tryout_application:"
        )
    ) {
        return false;
    }

    await interaction.deferReply({
        flags: MessageFlags.Ephemeral
    });

    const teamId =
        interaction.customId.split(":")[1];

    const team = getTryoutTeam(teamId);

    if (!team) {
        await interaction.editReply({
            content:
                "❌ This tryout team could not be found."
        });

        return true;
    }

    const playerName = cleanText(
        interaction.fields.getTextInputValue(
            "player_name"
        )
    );

    const ageText = cleanText(
        interaction.fields.getTextInputValue(
            "age"
        )
    );

    const tracker = cleanText(
        interaction.fields.getTextInputValue(
            "tracker"
        )
    );

    const location = cleanText(
        interaction.fields.getTextInputValue(
            "location"
        )
    );

    const availability = cleanText(
        interaction.fields.getTextInputValue(
            "availability"
        )
    );

    const age = Number(ageText);

    if (
        !Number.isInteger(age) ||
        age < 10 ||
        age > 99
    ) {
        await interaction.editReply({
            content:
                "❌ Please enter a valid age between 10 and 99."
        });

        return true;
    }

    if (!validTrackerUrl(tracker)) {
        await interaction.editReply({
            content:
                "❌ Please provide a valid Rocket League Tracker URL."
        });

        return true;
    }

    const tryoutData = loadTryouts();

    const existingApplication =
        findPendingApplication(
            tryoutData,
            interaction.user.id,
            teamId
        );

    if (existingApplication) {
        await interaction.editReply({
            content:
                `❌ You already have a pending application for **${team.label}**.`
        });

        return true;
    }

    const reviewChannelId =
        process.env.TRYOUT_REVIEW_CHANNEL_ID;

    if (!reviewChannelId) {
        await interaction.editReply({
            content:
                "❌ The application review channel has not been configured."
        });

        return true;
    }

    const reviewChannel =
        await fetchReviewChannel(
            interaction.client,
            reviewChannelId
        );

    if (!reviewChannel) {
        await interaction.editReply({
            content:
                "❌ The application review channel could not be accessed."
        });

        return true;
    }

    const applicationId =
        generateTryoutId(tryoutData);

    const application = {
        id: applicationId,
        userId: interaction.user.id,
        username: interaction.user.tag,
        teamId,
        teamName: team.label,
        teamLogoUrl: team.logoUrl || null,
        playerName,
        age,
        tracker,
        location,
        availability,
        status: "pending",
        submittedAt: new Date().toISOString(),
        reviewedAt: null,
        reviewedBy: null,
        declineReason: null,
        reviewChannelId,
        reviewMessageId: null
    };

    let reviewMessage;

    try {
        reviewMessage =
            await reviewChannel.send({
                embeds: [
                    buildPendingEmbed(application)
                ],
                components: [
                    buildReviewButtons(
                        applicationId
                    )
                ]
            });
    } catch (error) {
        console.error(
            "Failed to send tryout application:",
            error
        );

        await interaction.editReply({
            content:
                "❌ Your application could not be sent to staff. Please contact a staff member."
        });

        return true;
    }

    application.reviewMessageId =
        reviewMessage.id;

    tryoutData.applications.push(application);
    saveTryouts(tryoutData);

    await interaction.editReply({
        content:
            `✅ Your application for **${team.label}** has been submitted.\n\n` +
            `Application ID: **${applicationId}**`
    });

    return true;
}


/* -------------------------------------------------------------------------- */
/* Accept                                                                     */
/* -------------------------------------------------------------------------- */

async function handleAcceptButton(interaction) {
    if (!interaction.isButton()) {
        return false;
    }

    if (
        !interaction.customId.startsWith(
            "tryout_accept:"
        )
    ) {
        return false;
    }

    await interaction.deferReply({
        flags: MessageFlags.Ephemeral
    });

    const applicationId =
        interaction.customId.split(":")[1];

    const tryoutData = loadTryouts();

    const application = findTryout(
        tryoutData,
        applicationId
    );

    if (!application) {
        await interaction.editReply({
            content:
                "❌ This application could not be found."
        });

        return true;
    }

    if (application.status !== "pending") {
        await interaction.editReply({
            content:
                `❌ This application has already been **${application.status}**.`
        });

        return true;
    }

    if (
        !canReviewTryout(
            interaction.member,
            application.teamId
        )
    ) {
        await interaction.editReply({
            content:
                "❌ You do not have permission to review this application."
        });

        return true;
    }

    const team = getTryoutTeam(
        application.teamId
    );

    if (!team?.tryoutRoleId) {
        await interaction.editReply({
            content:
                "❌ The tryout role for this team is not configured."
        });

        return true;
    }

    let applicantMember;

    try {
        applicantMember =
            await interaction.guild.members.fetch(
                application.userId
            );
    } catch {
        await interaction.editReply({
            content:
                "❌ The applicant is no longer in the server."
        });

        return true;
    }

    if (
        applicantMember.id ===
        interaction.guild.ownerId
    ) {
        await interaction.editReply({
            content:
                "❌ I cannot manage the server owner's roles. Test the acceptance flow with a normal server member."
        });

        return true;
    }

    try {
        await applicantMember.roles.add(
            team.tryoutRoleId,
            `Tryout application ${application.id} accepted by ${interaction.user.tag}`
        );

        const freeAgentRoleId =
            process.env.FA_ROLE_ID;

        if (
            freeAgentRoleId &&
            applicantMember.roles.cache.has(
                freeAgentRoleId
            )
        ) {
            await applicantMember.roles.remove(
                freeAgentRoleId,
                `Tryout application ${application.id} accepted`
            );
        }
    } catch (error) {
        console.error(
            "Failed to update applicant roles:",
            error
        );

        await interaction.editReply({
            content:
                "❌ I could not update the applicant's roles. Make sure my bot role has **Manage Roles** and is positioned above the Free Agent and tryout roles."
        });

        return true;
    }

    application.status = "accepted";
    application.reviewedBy =
        interaction.user.id;
    application.reviewedByName =
        interaction.user.tag;
    application.reviewedAt =
        new Date().toISOString();
    application.declineReason = null;

    saveTryouts(tryoutData);

    const reviewMessage =
        await fetchReviewMessage(
            interaction,
            application
        );

    let messageUpdated = false;

    if (reviewMessage) {
        try {
            await reviewMessage.edit({
                embeds: [
                    buildAcceptedEmbed(application)
                ],
                components: []
            });

            messageUpdated = true;
        } catch (error) {
            console.error(
                "Failed to update accepted application message:",
                error
            );
        }
    }

let dmSent = true;

try {
    const dmCard = buildTryoutDmCard({
        accepted: true,
        application,
        reviewer: interaction.user.tag
    });

    await applicantMember.send({
        components: [dmCard],
        flags: MessageFlags.IsComponentsV2
    });
} catch (error) {
        dmSent = false;

        console.log(
            `Could not DM accepted applicant ${application.userId}:`,
            error.message
        );
    }

    const notes = [];

    if (!dmSent) {
        notes.push(
            "I could not DM the applicant."
        );
    }

    if (!messageUpdated) {
        notes.push(
            "I could not update the review message."
        );
    }

    await interaction.editReply({
        content:
            `✅ **${application.playerName}** has been accepted for **${application.teamName}**.` +
            (
                notes.length
                    ? `\n\n⚠️ ${notes.join(" ")}`
                    : ""
            )
    });

    return true;
}


/* -------------------------------------------------------------------------- */
/* Decline button                                                             */
/* -------------------------------------------------------------------------- */

async function handleDeclineButton(interaction) {
    if (!interaction.isButton()) {
        return false;
    }

    if (
        !interaction.customId.startsWith(
            "tryout_decline:"
        )
    ) {
        return false;
    }

    const applicationId =
        interaction.customId.split(":")[1];

    const tryoutData = loadTryouts();

    const application = findTryout(
        tryoutData,
        applicationId
    );

    if (!application) {
        await interaction.reply({
            content:
                "❌ This application could not be found.",
            flags: MessageFlags.Ephemeral
        });

        return true;
    }

    if (application.status !== "pending") {
        await interaction.reply({
            content:
                `❌ This application has already been **${application.status}**.`,
            flags: MessageFlags.Ephemeral
        });

        return true;
    }

    if (
        !canReviewTryout(
            interaction.member,
            application.teamId
        )
    ) {
        await interaction.reply({
            content:
                "❌ You do not have permission to review this application.",
            flags: MessageFlags.Ephemeral
        });

        return true;
    }

    const modal = new ModalBuilder()
        .setCustomId(
            `tryout_decline_modal:${applicationId}`
        )
        .setTitle("Decline Tryout Application");

    const reasonInput =
        new TextInputBuilder()
            .setCustomId("decline_reason")
            .setLabel("Reason for declining")
            .setPlaceholder(
                "Explain briefly why this application was declined."
            )
            .setRequired(true)
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(3)
            .setMaxLength(1000);

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            reasonInput
        )
    );

    await interaction.showModal(modal);

    return true;
}


/* -------------------------------------------------------------------------- */
/* Decline modal                                                              */
/* -------------------------------------------------------------------------- */

async function handleDeclineModal(interaction) {
    if (!interaction.isModalSubmit()) {
        return false;
    }

    if (
        !interaction.customId.startsWith(
            "tryout_decline_modal:"
        )
    ) {
        return false;
    }

    await interaction.deferReply({
        flags: MessageFlags.Ephemeral
    });

    const applicationId =
        interaction.customId.split(":")[1];

    const reason = cleanText(
        interaction.fields.getTextInputValue(
            "decline_reason"
        )
    );

    const tryoutData = loadTryouts();

    const application = findTryout(
        tryoutData,
        applicationId
    );

    if (!application) {
        await interaction.editReply({
            content:
                "❌ This application could not be found."
        });

        return true;
    }

    if (application.status !== "pending") {
        await interaction.editReply({
            content:
                `❌ This application has already been **${application.status}**.`
        });

        return true;
    }

    if (
        !canReviewTryout(
            interaction.member,
            application.teamId
        )
    ) {
        await interaction.editReply({
            content:
                "❌ You do not have permission to review this application."
        });

        return true;
    }

    application.status = "declined";
    application.reviewedBy =
        interaction.user.id;
    application.reviewedByName =
        interaction.user.tag;
    application.reviewedAt =
        new Date().toISOString();
    application.declineReason = reason;

    saveTryouts(tryoutData);

    const reviewMessage =
        await fetchReviewMessage(
            interaction,
            application
        );

    let messageUpdated = false;

    if (reviewMessage) {
        try {
            await reviewMessage.edit({
                embeds: [
                    buildDeclinedEmbed(application)
                ],
                components: []
            });

            messageUpdated = true;
        } catch (error) {
            console.error(
                "Failed to update declined application message:",
                error
            );
        }
    }

const declinedDmCard = buildTryoutDmCard({
    accepted: false,
    application,
    reviewer: interaction.user.tag,
    reason
});

const dmSent = await sendApplicantDm(
    interaction.client,
    application.userId,
    {
        components: [declinedDmCard],
        flags: MessageFlags.IsComponentsV2
    }
);

    const notes = [];

    if (!dmSent) {
        notes.push(
            "I could not DM the applicant."
        );
    }

    if (!messageUpdated) {
        notes.push(
            "I could not update the review message."
        );
    }

    await interaction.editReply({
        content:
            `✅ **${application.playerName}**'s application was declined.` +
            (
                notes.length
                    ? `\n\n⚠️ ${notes.join(" ")}`
                    : ""
            )
    });

    return true;
}


/* -------------------------------------------------------------------------- */
/* Main tryout interaction router                                             */
/* -------------------------------------------------------------------------- */

async function handleTryoutInteraction(interaction) {
    if (await handleTryoutButton(interaction)) {
        return true;
    }

    if (await handleTryoutSelect(interaction)) {
        return true;
    }

    if (await handleApplicationModal(interaction)) {
        return true;
    }

    if (await handleAcceptButton(interaction)) {
        return true;
    }

    if (await handleDeclineButton(interaction)) {
        return true;
    }

    if (await handleDeclineModal(interaction)) {
        return true;
    }

    return false;
}

module.exports = {
    handleTryoutInteraction,
    async submitWebTryout(client, payload) {
        const websiteTeamMap = {
            esports: "main",
            vanguards: "vanguards",
            academy: "academy"
        };
        const teamId = websiteTeamMap[payload?.teamId];
        const team = teamId ? getTryoutTeam(teamId) : null;
        const discordId = String(payload?.applicant?.discordId || "");
        const playerName = cleanText(payload?.application?.playerName);
        const age = Number(payload?.application?.age);
        const tracker = cleanText(payload?.application?.trackerUrl);
        const location = cleanText(payload?.application?.country);
        const availability = cleanText(payload?.application?.availability);

        if (!team || !/^\d{17,20}$/.test(discordId)) {
            throw new Error("Invalid web application team or Discord account");
        }
        if (playerName.length < 2 || playerName.length > 50 || !Number.isInteger(age) || age < 10 || age > 99 || !validTrackerUrl(tracker) || location.length < 2 || location.length > 100 || availability.length < 2 || availability.length > 1200) {
            throw new Error("Invalid web application fields");
        }

        const tryoutData = loadTryouts();
        const websiteApplicationId = cleanText(payload?.applicationId).slice(0, 100);
        const priorWebsiteApplication = websiteApplicationId && tryoutData.applications.find(application => application.sourceApplicationId === websiteApplicationId);
        if (priorWebsiteApplication) {
            return { applicationId: priorWebsiteApplication.id, duplicate: true };
        }
        const existingApplication = findPendingApplication(tryoutData, discordId, teamId);
        if (existingApplication) {
            return { applicationId: existingApplication.id, duplicate: true };
        }

        const reviewChannelId = process.env.TRYOUT_REVIEW_CHANNEL_ID;
        const reviewChannel = await fetchReviewChannel(client, reviewChannelId);
        if (!reviewChannel) {
            throw new Error("Tryout review channel is not configured or unavailable");
        }

        let username = cleanText(payload?.applicant?.discordUsername).slice(0, 80) || discordId;
        try {
            const discordUser = await client.users.fetch(discordId);
            username = discordUser.tag || discordUser.username || username;
        } catch (error) {
            console.warn("Could not fetch the web applicant's Discord profile:", error.message);
        }

        const applicationId = generateTryoutId(tryoutData);
        const application = {
            id: applicationId,
            userId: discordId,
            username,
            teamId,
            teamName: team.label,
            teamLogoUrl: team.logoUrl || null,
            playerName,
            age,
            tracker,
            location,
            availability,
            status: "pending",
            submittedAt: new Date().toISOString(),
            reviewedAt: null,
            reviewedBy: null,
            declineReason: null,
            reviewChannelId,
            reviewMessageId: null,
            source: "holofyrn.eu",
            sourceApplicationId: websiteApplicationId || null
        };

        const reviewMessage = await reviewChannel.send({
            embeds: [buildPendingEmbed(application)],
            components: [buildReviewButtons(applicationId)]
        });
        application.reviewMessageId = reviewMessage.id;
        tryoutData.applications.push(application);
        saveTryouts(tryoutData);
        return { applicationId, duplicate: false };
    }
};
