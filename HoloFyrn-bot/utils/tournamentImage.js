const { URL } = require("node:url");

const MAX_BANNER_SIZE = 20 * 1024 * 1024;
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp)$/i;

function isDiscordImageUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "cdn.discordapp.com" ||
      host === "media.discordapp.net" ||
      host === "cdn.discordapp.net";
  } catch {
    return false;
  }
}

// For a copied announcement, re-upload the ORIGINAL attachment rather than
// linking to its potentially expiring CDN URL. Using the original message
// fetches a fresh attachment URL from Discord.
async function copyOriginalTournamentImage(client, sourceEvent) {
  if (!sourceEvent.imageUrl) return null;

  let attachment;
  try {
    if (sourceEvent.channelId && sourceEvent.messageId) {
      const channel = await client.channels.fetch(sourceEvent.channelId);
      const message = await channel.messages.fetch(sourceEvent.messageId);
      attachment = message.attachments.find(item =>
        item.contentType?.startsWith("image/") || IMAGE_EXTENSIONS.test(item.name || "")
      );
    }
  } catch (error) {
    console.warn("Could not fetch the source tournament image:", error.message);
  }

  if (!attachment) {
    if (isDiscordImageUrl(sourceEvent.imageUrl)) {
      throw new Error(
        "The original Discord banner could not be retrieved. " +
        "Attach a new `picture`, or set `remove_picture:true` to copy without it."
      );
    }
    // Externally hosted banner images can keep their existing public URL.
    return null;
  }

  if (attachment.size > MAX_BANNER_SIZE) {
    throw new Error("The original banner is too large (over 20 MB). Upload a smaller `picture`.");
  }

  const response = await fetch(attachment.url, {
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    throw new Error(
      "Couldn't download the original banner from Discord. " +
      "Attach a new `picture`, or set `remove_picture:true`."
    );
  }

  const fileBuffer = Buffer.from(await response.arrayBuffer());
  if (fileBuffer.length > MAX_BANNER_SIZE) {
    throw new Error("The original banner is too large (over 20 MB). Upload a smaller `picture`.");
  }

  const originalName = String(attachment.name || "banner.png");
  const safeName = originalName.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(-100) || "banner.png";
  return { attachment: fileBuffer, name: safeName };
}

module.exports = { copyOriginalTournamentImage, isDiscordImageUrl };
