const path = require("path");

module.exports = Object.freeze({
  name: "HoloFyrn Esports",
  shortName: "HoloFyrn",
  color: 0x7A101B,

  rosterTitle: "HOLOFYRN ESPORTS ROSTERS",

  logoUrl: process.env.BRAND_LOGO_URL || null,

  rosterBannerFileName: "HoloFyrn_Join_Banner.png",

  rosterBannerPath: path.join(
    __dirname,
    "..",
    "assets",
    "HoloFyrn_Join_Banner.png"
  )
});