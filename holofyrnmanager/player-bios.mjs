const bios = {
  kenz: {
    en: [
      "I'm Kenz, a Rocket League player and manager for HoloFyrn Esports. As a player, I believe in thoughtful, team-focused play, where communication, decision-making and coordination are just as important as individual performance.",
      'My goal is to keep taking my own game to a higher level while contributing to the development of the team around me. As a manager, I value creating an environment where every player has the opportunity to reach their full potential.',
      'HoloFyrn is more than a team to me. It is a long-term project we are building to compete both domestically and internationally.'
    ].join('\n\n'),
    hu: [
      'Kenz vagyok, a HoloFyrn Esports Rocket League játékosa és managere. Játékosként elsősorban a tudatos, csapatközpontú játékban hiszek, ahol az egyéni teljesitmény mellett a kommunikáció, a döntéshozatal és az összhang is meghatározó szerepet kap.',
      'Célom, hogy folyamatosan magasabb szintre emeljem a saját játékomat, miközben a körülöttem lévő csapat fejlődéséhez is hozzájárulok. Managerként fontosnak tartom, hogy egy olyan környezetet alakitsak ki, ahol minden játékosnak megvan a lehetősége arra, hogy kihozza magából a maximumot.',
      'A HoloFyrn számomra több mint egy csapat. Egy hosszú távú projekt, amelyet azért épitűnk, hogy versenyképesek legyünk nemcsak hazai, hanem nemzetközi szinten is.'
    ].join('\n\n')
  },
  zemstaAcademy: {
    en: [
      "I'm Zemsta, captain of the HoloFyrn Esport Academy team. My main goal right now is to bring out the best in the club's players and help them keep developing both mentally and as esports competitors.",
      'The Academy is made up of talented and motivated players who have the potential to compete at a higher level in the future. Creating an environment where everyone has the opportunity to improve, gain experience and reach their full potential is important to me.',
      'My long-term goal is to help as many Academy players as possible reach the level needed to join the HoloFyrn main team and prove themselves there as well.'
    ].join('\n\n'),
    hu: [
      'Zemsta vagyok, a HoloFyrn Esport Academy csapatkapitánya. Jelenlegi fő célom, hogy az egyesület játékosaiból a lehető legtöbbet hozzam ki, és segítsem őket abban, hogy folyamatosan fejlődjenek mind mentálisan, mind esportolóként.',
      'Az Academy olyan tehetséges és motivált játékosokból áll, akikben megvan a potenciál arra, hogy a jövőben magasabb szinten is megállják a helyüket. Fontos számomra, hogy egy olyan környezetet alakítsunk ki, ahol mindenki lehetőséget kap a fejlődésre, tapasztalatszerzésre és arra, hogy kihozza magából a maximumot.',
      'Hosszú távú célom, hogy minél több Academy játékos eljusson arra a szintre, hogy bekerülhessen a HoloFyrn főcsapatába, és ott is bizonyítani tudjon.'
    ].join('\n\n')
  }
};

export function legacyPlayerBio(name, team) {
  const normalizedName = String(name || '').trim().toLowerCase();
  if (normalizedName === 'kenz') return bios.kenz;
  if (normalizedName === 'zemsta' && String(team || '').toLowerCase() === 'academy') return bios.zemstaAcademy;
  return {en:'', hu:''};
}
