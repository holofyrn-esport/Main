# Nyilvános játékosok és eredmények Spark csomaggal

A HoloFyrn oldal a Firebase Authentication anonim bejelentkezésével olvassa a `holofyrnPublic/main` Firestore-dokumentumot. A HoloFyrn Manager a játékosok és eredmények mentésekor ebbe a dokumentumba csak a nyilvános mezőket másolja. A Manager valamelyik admin, coach, manager vagy captain fiókjának első bejelentkezése létrehozza a kezdeti nyilvános adatot is.

## Egyszeri beállítás

1. A Firebase Console-ban a `noctiq-d1020` projekt Authentication → Sign-in method részén kapcsold be az **Anonymous** szolgáltatót. Az Email/Password szolgáltató maradjon bekapcsolva a Managerhez.
2. Telepítsd a [Firestore-szabályokat](../HoloFyrnManager/firestore.rules) a Firebase Console Rules felületén, vagy Firebase CLI-vel: `firebase deploy --project noctiq-d1020 --only firestore:rules` a `HoloFyrnManager` mappából.
3. Ellenőrizd, hogy a Manager-fiókokhoz már létezik jóváhagyott `users/{uid}` profil. Jelentkezz be egyszer a Managerbe egy admin, coach, manager vagy captain fiókkal. Ekkor feltöltődik a `holofyrnPublic/main` dokumentum.
4. Tedd közzé a módosított statikus fájlokat GitHub Pagesen.

Az oldal a Firebase-dokumentum változásait figyeli. A teljes `noctiqManager/main` dokumentumot az anonim látogatók nem olvashatják. A Managerhez már létező, jóváhagyott profil szükséges; a régi, profil nélküli fiókokat adminnak kell rendeznie. A korábbi, `publicHoloFyrnData` nevű HTTP-funkcióra nincs szükség; ha már telepítve volt, külön törölhető a Firebase-projektből. A Manager meglévő fióktörlő funkciója ettől független.
