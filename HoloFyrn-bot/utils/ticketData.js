const fs = require("fs");
const path = require("path");

const ticketPath = path.join(__dirname, "..", "data", "tickets.json");

function loadTickets() {
  return JSON.parse(fs.readFileSync(ticketPath, "utf8"));
}

function saveTickets(data) {
  fs.writeFileSync(ticketPath, JSON.stringify(data, null, 2));
}

function getNextTicketId(data) {
  data.lastId += 1;
  return `V-${String(data.lastId).padStart(3, "0")}`;
}

module.exports = {
  loadTickets,
  saveTickets,
  getNextTicketId
};