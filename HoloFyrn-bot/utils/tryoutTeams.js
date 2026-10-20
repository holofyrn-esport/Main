const fs = require("fs");
const path = require("path");

const rostersPath = path.join(
    __dirname,
    "..",
    "data",
    "rosters.json"
);

// Optional special settings for known teams.
// Any team that is not listed here will STILL appear in the tryout menu.
// These settings only provide custom descriptions/emojis and role permissions.
const teamConfig = {
    main: {
        description: "Apply for the HoloFyrn main roster.",
        tryoutRoleEnv: "TRYOUT_NOCTIQ_ROLE_ID",
        captainRoleEnv: "NOCTIQ_CAPTAIN_ROLE_ID"
    },

    academy: {
        description: "Apply for the HoloFyrn Academy roster.",
        tryoutRoleEnv: "TRYOUT_ACADEMY_ROLE_ID",
        captainRoleEnv: "ACADEMY_CAPTAIN_ROLE_ID"
    },

    vanguards: {
        description: "Apply for the HoloFyrn Vanguards roster.",
        tryoutRoleEnv: "TRYOUT_VANGUARDS_ROLE_ID",
        captainRoleEnv: "VANGUARDS_CAPTAIN_ROLE_ID"
    },

    rls: {
        description: "Apply for the RLS HoloFyrn roster.",
        tryoutRoleEnv: "TRYOUT_RLS_ROLE_ID",
        captainRoleEnv: "RLS_MAIN_CAPTAIN_ROLE_ID"
    },

    "rls-academy": {
        description: "Apply for the RLS HoloFyrn Esports Academy roster.",
        tryoutRoleEnv: "TRYOUT_RLS_ROLE_ID",
        captainRoleEnv: "RLS_ACADEMY_CAPTAIN_ROLE_ID"
    },

    synq: {
        description: "Apply for the HoloFyrn Synq roster.",
        captainRoleEnv: "SYNQ_CAPTAIN_ROLE_ID"
    },

    eldr: {
        description: "Apply for the RLS HoloFyrn Eldr roster.",
        tryoutRoleEnv: "TRYOUT_RLS_ROLE_ID",
        captainRoleEnv: "ELDR_CAPTAIN_ROLE_ID"
    }
};

function loadRosters() {
    if (!fs.existsSync(rostersPath)) {
        console.error(
            "❌ data/rosters.json could not be found."
        );

        return null;
    }

    try {
        const content = fs.readFileSync(
            rostersPath,
            "utf8"
        );

        return JSON.parse(content);
    } catch (error) {
        console.error(
            "❌ Failed to read rosters.json:",
            error
        );

        return null;
    }
}

function buildTeam(team) {
    const config = teamConfig[team.id] || {};

    return {
        id: team.id,
        label: team.name,
        shortName: team.shortName || team.name,

        description:
            config.description ||
            `Apply for the ${team.name} roster.`,

        logoUrl:
            team.logoUrl || null,

        logoEmojiId:
            team.logoEmojiId || null,

        logoEmojiName:
            team.logoEmojiName || null,

        logoEmojiAnimated:
            Boolean(team.logoEmojiAnimated),

        tryoutRoleId:
            team.tryoutRoleId ||
            (
                config.tryoutRoleEnv
                    ? process.env[config.tryoutRoleEnv] || null
                    : null
            ),

        captainRoleId:
            team.captainRoleId ||
            config.captainRoleId ||
            (
                config.captainRoleEnv
                    ? process.env[config.captainRoleEnv] || null
                    : null
            )
    };
}

function getAvailableTryoutTeams() {
    const rosterData = loadRosters();

    if (
        !rosterData ||
        !Array.isArray(rosterData.teams)
    ) {
        console.error(
            "❌ rosters.json does not contain a teams array."
        );

        return [];
    }

    // The tryout menu now follows the actual roster list automatically.
    // Prospect remains excluded because it is not a normal tryout roster.
    return rosterData.teams
        .filter(team =>
            team &&
            team.id &&
            team.name &&
            team.id !== "prospect"
        )
        .map(buildTeam);
}

function getTryoutTeam(teamId) {
    const availableTeams =
        getAvailableTryoutTeams();

    return (
        availableTeams.find(
            team => team.id === teamId
        ) || null
    );
}

function canReviewTryout(member, teamId) {
    const staffRoleId =
        process.env.STAFF_ROLE_ID;

    const team = getTryoutTeam(teamId);

    if (!team || !member?.roles?.cache) {
        return false;
    }

    const isStaff =
        staffRoleId &&
        member.roles.cache.has(staffRoleId);

    const isTeamCaptain =
        team.captainRoleId &&
        member.roles.cache.has(
            team.captainRoleId
        );

    return Boolean(
        isStaff || isTeamCaptain
    );
}

function validateTryoutRoleConfiguration() {
    const teams = getAvailableTryoutTeams();
    const missing = [];

    if (!process.env.STAFF_ROLE_ID) {
        missing.push("STAFF_ROLE_ID");
    }

    if (!process.env.FA_ROLE_ID) {
        missing.push("FA_ROLE_ID");
    }

    // Only require dedicated role configuration for teams that explicitly
    // define those environment variables in teamConfig. This prevents a
    // newly created roster from breaking the entire tryout system.
    for (const team of teams) {
        const config = teamConfig[team.id];

        if (!config) {
            continue;
        }

        if (
            config.tryoutRoleEnv &&
            !team.tryoutRoleId
        ) {
            missing.push(
                `${team.label}: tryout role`
            );
        }

        if (
            config.captainRoleEnv &&
            !team.captainRoleId
        ) {
            missing.push(
                `${team.label}: captain role`
            );
        }
    }

    return {
        valid: missing.length === 0,
        missing
    };
}

module.exports = {
    getAvailableTryoutTeams,
    getTryoutTeam,
    canReviewTryout,
    validateTryoutRoleConfiguration
};
