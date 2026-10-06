const path = require('node:path');
const sharp = require('sharp');

const assets = path.resolve(__dirname, '..', 'assets');

async function create(source, target, width, options = {}) {
  const input = path.join(assets, source);
  const output = path.join(assets, target);
  const result = await sharp(input)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({
      quality: options.quality ?? 88,
      alphaQuality: options.alphaQuality ?? 100,
      effort: 6,
    })
    .toFile(output);
  console.log(`${target}: ${result.width}x${result.height}, ${result.size} bytes`);
}

async function main() {
  const tasks = [];
  for (const width of [640, 1280, 1920]) {
    tasks.push(create('hero-2560.webp', `hero-${width}.webp`, width, { quality: 86 }));
  }
  for (const image of [
    'HolofyrnMainBG.webp', 'HoloFyrnAcademyBG.webp', 'RLSHoloFyrnMainBG.webp',
    'RLSHolofyrnacademyBG.webp', 'RLSHoloFyrnEldBG.webp', 'HolofyrnShadowsBG.webp',
    'HoloFyrnVanguardsBG.webp',
  ]) {
    const stem = image.slice(0, -5);
    for (const width of [480, 960]) tasks.push(create(image, `${stem}-${width}.webp`, width, { quality: 88 }));
  }
  for (const image of [
    'HolofyrnMain-transparent.webp', 'HolofyrnAcademy-transparent.webp',
    'RLSHolofyrnMain-transparent.webp', 'RLSHoloFyrnAcademy-transparent.webp',
    'RLSHolofyrnEldr-transparent.webp', 'HoloFyrnShadows-transparent.webp',
    'HoloFyrnVanguards-transparent.webp',
  ]) {
    const stem = image.slice(0, -5);
    for (const width of [360, 720]) tasks.push(create(image, `${stem}-${width}.webp`, width, { quality: 90 }));
  }
  tasks.push(create('brand-logo.webp', 'brand-logo-64.webp', 64, { quality: 92 }));
  tasks.push(create('brand-logo.webp', 'brand-logo-128.webp', 128, { quality: 92 }));
  tasks.push(create('Rllogo.webp', 'Rllogo-960.webp', 720, { quality: 92 }));
  tasks.push(create('site-background.webp', 'site-background-1920.webp', 1920, { quality: 90 }));
  tasks.push(create('NorwayNews.webp', 'NorwayNews-480.webp', 480, { quality: 88 }));
  tasks.push(create('NorwayNews.webp', 'NorwayNews-960.webp', 960, { quality: 88 }));
  tasks.push(create('Elnokseg.webp', 'Elnokseg-800.webp', 800, { quality: 88 }));
  tasks.push(create('Elnokseg.webp', 'Elnokseg-1200.webp', 1200, { quality: 88 }));
  tasks.push(create('whatsnext.webp', 'whatsnext-1200.webp', 1200, { quality: 88 }));
  tasks.push(create('KenzStaff.webp', 'KenzStaff-1200.webp', 1200, { quality: 88 }));
  tasks.push(create('bigv.webp', 'bigv-360.webp', 360, { quality: 88 }));
  tasks.push(create('NoPicPlayer.webp', 'NoPicPlayer-960.webp', 960, { quality: 88 }));
  tasks.push(create('kenz-signature.webp', 'kenz-signature-1200.webp', 1200, { quality: 90 }));
  tasks.push(create('zemsta-signature.webp', 'zemsta-signature-1200.webp', 1200, { quality: 90 }));
  tasks.push(create('zemsta.webp', 'zemsta-1200.webp', 1200, { quality: 90 }));
  await Promise.all(tasks);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
