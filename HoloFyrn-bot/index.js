require('dotenv').config();
const { initializeDataFiles } = require('./utils/initializeData');
initializeDataFiles();

const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, REST, Routes, MessageFlags } = require('discord.js');
const { handleTournamentLft } = require('./buttons/tournamentLft');
const { handleTicketOpen } = require('./buttons/ticketOpen');
const { handleCaptainDashboardSelect } = require('./buttons/captainDashboardSelect');
const { handleTryoutInteraction } = require('./handlers/tryoutHandler');
const { handleSelfRoleButton } = require('./buttons/selfRoles');
const { handleRosterTeamInteraction } = require('./handlers/rosterTeamManager');
const { startWebApplicationServer } = require('./webApplicationServer');

const {
  startLftAutoRefresh
} = require("./utils/lftAutoRefresh");
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
startWebApplicationServer(client);
client.commands = new Collection();

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  if (!command.data || !command.execute) {
    console.log(`❌ ${file} is missing module.exports.data or module.exports.execute`);
    continue;
  }
  client.commands.set(command.data.name, command);
  commands.push(command.data.toJSON());
  console.log(`✅ Loaded command: /${command.data.name}`);
}

client.once('clientReady', async () => {

  console.log(`✅ Logged in as ${client.user.tag}`);
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
startLftAutoRefresh(client);
    console.log('✅ Slash commands registered.');
  } catch (error) {
    console.error('❌ Failed to register slash commands:', error);
  }
});

client.on('interactionCreate', async interaction => {
  try {
    if (await handleTryoutInteraction(interaction)) return;
    if (await handleRosterTeamInteraction(interaction)) return;

    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;
      await command.autocomplete(interaction);
      return;
    }

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('captain_dashboard_')) {
      await handleCaptainDashboardSelect(interaction);
      return;
    }

    if (interaction.isButton()) {
      if (await handleSelfRoleButton(interaction)) return;
      if (interaction.customId === 'ticket_open_verification') {
        await handleTicketOpen(interaction);
        return;
      }
      if (interaction.customId.startsWith('tournament_lft_')) {
        await handleTournamentLft(interaction);
        return;
      }
    }
  } catch (error) {
    console.error(error);
    const response = { content: '❌ Something went wrong.', flags: MessageFlags.Ephemeral };
    try {
      if (interaction.replied || interaction.deferred) await interaction.followUp(response);
      else await interaction.reply(response);
    } catch (responseError) {
      console.error('Could not send interaction error response:', responseError);
    }
  }
});

client.login(process.env.TOKEN);
