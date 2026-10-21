# Gnome Disposal Inc. — specyfikacja gry

Ten plik opisuje, jak gra działa dziś, obszar po obszarze, a pod każdym obszarem leżą decyzje z krótkim „dlaczego”.
Plik jest aktualizowany po każdej wdrożonej zmianie: co się zmieniło dla gracza i decyzja z powodem. Szczegóły techniczne i pomiary zostają w `docs/ai-work/`.

## Specyfikacja gry

### Cel i pętla gry

- Gracz stoi w ogrodzie w pierwszej osobie. Fabryka robi gnomy. Gracz wrzuca gnomy do dziury i dostaje pieniądze.
- Za każdego zjedzonego gnoma z dziury wylatują monety: wartość gnoma x mnożnik dziury x combo x ulepszenia x bonusy odrodzenia. Każdy gnom dodaje też punkty dziury (XP). Zwykły gnom = 1 XP.
- Monety zbiera gracz (promień Coin Magnet) albo Piggy Bank. Każda moneta leci na ekranie do licznika pieniędzy (0,5 s) i dopiero wtedy dolicza się do kasy. Monety zostawione na trawie same wracają po 40 s.
- Pieniądze idą do sklepu (komputer przy biurku albo klawisz B z Laptopem). Sklep daje narzędzia, maszyny i ulepszenia.
- Dziura rośnie: 12 poziomów, większy promień i mnożnik, nowe typy gnomów, nowe ziemie, eventy. Na poziomie 12 gracz wskakuje do dziury (The Deep), widzi zakończenie i odradza się z odłamkami (Hole Shards) na stałe bonusy.
- Drogi do poziomu 12 (model ekonomii, czasy z symulatora): ręce 307 min, Magnet Gun 39 min, skrzynia 23 min, automatyzacja 27 min, traktor 30 min. Cel PP to 2-3 godziny, dziś maszyny kończą w pół godziny (otwarte pytanie do PP).

Decyzje:
- (PP, 2026-10-19) Mnożnik dziury x1..x10 zamiast x100, kasa z maszyn pełna, ceny rosną łagodnie: bo pierwszy playtest skończył się na 5 wentylatorach i $119m, gra wyglądała jak idle clicker.
- (PP, 2026-10-19) Gra ma być zręcznościowa: gnomy mają wagę, nosi się jedno naraz (chyba że Magnet Gun), tricki płacą więcej.
- (PP, 2026-10-20) „Gra przechodzi się w pół godziny” na razie zostaje bez zmian; tempo XP wg sposobu karmienia odłożone („jeszcze nie wiem co i jak”).
- (PP, 2026-10-20) Gra nazywa się „Gnome Disposal Inc.” (tytuł karty, logo w menu, adres GitHub Pages `/gnome-disposal-inc/`), żeby nie kopiować nazwy oryginału. Klucze zapisu w przeglądarce zostają ze starą nazwą, bo nowe klucze skasowałyby istniejące zapisy.

### Dziura

- Poziomy (XP do następnego / promień / mnożnik / co odblokowuje): 1: 25 / 1,6 m / x1; 2: 60 / 2,0 / x1,5 / chciwe gnomy, eventy; 3: 120 / 2,4 / x2 / wściekłe gnomy, ziemia Garden; 4: 220 / 2,8 / x2,5 / krasnale (dwarf), Auto Crank; 5: 380 / 3,2 / x3 / sabotażyści, ziemia Neighbour's Lawn; 6: 600 / 3,6 / x4 / noc, Shadow Gnome; 7: 900 / 4,0 / x5 / czarodzieje; 8: 1300 / 4,4 / x6 / grube gnomy, ziemia Dark Forest; 9: 1800 / 4,8 / x7 / więcej złotych (3% zamiast 0,4%); 10: 2500 / 5,2 / x8 / King Gnome; 11: 3400 / 5,6 / x9; 12: MAX / 6,0 / x10 / The Deep.
- Awans poziomu: fala uderzeniowa odrzuca wolne gnomy w promieniu 10 m, dziura rośnie i przesuwa się o 1,2 m dalej od fabryki. Narzędzia stojące do 1,5 m od krawędzi jadą razem z dziurą (0,25 s). Narzędzia, które nowa dziura by przykryła, wracają do ekwipunku z komunikatem.
- Kotwice na ziemiach: dziura na poziomie 1 stoi w stałym punkcie danej ziemi (Backyard 0,0; Garden -10,6; Neighbour's Lawn 10,2; Dark Forest -24,-34), 15 / 19 / 23 / 27 m od fabryki. Kiedy gracz kupi ziemię, wtedy dziura zjeżdża w 1 s na nowe miejsce (kurz, drżenie), a narzędzia przy krawędzi jadą z nią.
- Combo: każdy gnom zjedzony w oknie combo dodaje +1. Mnożnik 1 + combo x 0,05, limit x2 (+0,5 za poziom Combo Cap, +0,5 za każdą ziemię, +0,5 za Deep Combo). Okno 2,5 s (+0,4 s za poziom Combo Window). Progi z tekstem, drżeniem i dźwiękiem: Nice (5), Gnomazing (15), Gnomenal (30), GNOMEGEDDON (60), HOLE-Y MOLY (100). Rozbłysk cząstek przy zjedzeniu rośnie z combo (14 przy 1, 36 przy 30). Combo nie gaśnie, póki gracz trzyma gnoma. Combo Insurance zostawia połowę po zerwaniu. Jackpot: co 25 combo fontanna monet.
- Trickshoty (tylko rzut gracza, mnożą się, limit x20): AIR x2 (bez dotknięcia ziemi) +$10; LONG SHOT x2,5 (z 8 m) +$20; TRICK x3 (przez trampolinę) +$25; SNIPER x4 (z 14 m, zamiast LONG SHOT) +$40; BULLSEYE x5 (przez złotą obręcz obok dziury) +$60. Stała premia mnoży się przez mnożnik dziury i Premium Gnomes. Każdy trick to wielki napis z mnożnikami i kwotą, złote iskry, fanfara, drżenie. HEAVY HAUL to sam napis za masywnego gnoma.
- Salwa (Magnet Gun): każdy gnom z kuli liczy własne tricki, limit salwy x8, premia stała raz na rzut. Napis np. „VOLLEY · LONG SHOT x2,5 + AIR x2 = x5 (7 gnomes)”.
- STRIKE: gnom rzucony przez gracza (ponad 6 m/s), który wepchnie 2+ gnomy do dziury w 2 s, daje +$25 x liczba x mnożnik, napis STRIKE xN; 5+ to TURKEY. Ciężkie gnomy to najlepsze kule.
- Zrzut skrzyni: wszystkie gnomy ze skrzyni naraz, do tego premia 2 x liczba x mnożnik („CRATE DUMP x12!”). Gnomy wrzucone do skrzyni tracą flagi tricków.
- Nastroje dziury (od poziomu 2, co 150-200 s): przez 45 s dziura „pragnie” jednego typu (nigdy zwykłego, złotego ani króla), ten typ płaci x3; baner i szept. Drwiny: po 5 pudłach z rzędu „Five misses. Pathetic.”, po LONG SHOT „Ooh.”.
- Slow-mo: combo 60 lub 100 i zjedzony król zamrażają grę na 0,08 s, potem 0,6 s w ćwierć tempa; najwyżej raz na 5 s.
- Wpadnięcie gracza do dziury: dziura go wypluwa z fontanną monet, ale płaci tylko raz na poziom w danym biegu.
- Dziura nie ma obwódki; jedzenie przyspiesza wir, od combo 10 wir zmienia kolor (biały → fiolet → złoto).

Decyzje:
- (PP, 2026-10-19) „x2, x5, aby było warto”: tricki płacą x2..x5 i świętują, bo wcześniej nie było widać, że się opłacają.
- (PP, 2026-10-20) Stała premia za trick: bo na poziomie 1 gnom wart $1, x20 dawało $20, a fotel $250; „musi być to sensowne na początku”.
- (PP, 2026-10-20) Limit salwy x4 → x8: żeby AIR dalej płacił na salwie SNIPER.
- (PP, 2026-10-20) Dziura nie losuje miejsca po kupnie ziemi, ma stałe kotwice: „albo nie losuj i daj je na stałe”, żeby dało się zaplanować konstrukcję.
- (PP, 2026-10-20) Bez obwódki dziury i animacji jedzenia obwódką.
- (sesja, 2026-10-20) Fotel i flaming płacą pełną stawkę tylko do zdobycia osiągnięcia, potem 10%; chciwy gnom oddaje łup x1 bez monet; wpadnięcie gracza płaci raz na poziom: bo to były pętle na nieskończoną kasę (F4, F5, F6).
- (PP, 2026-10-20) Trickshot (BULLSEYE) nie zwalnia już czasu, zostają napis, premia, iskry, fanfara i drżenie: „myślałem, że gra się zacina”.
- (sesja, 2026-10-20) Slow-mo i STRIKE bez zapisu: po przeładowaniu zaczynają od zera, bo to chwilowe efekty.

### Gnomy

- Typy (wartość w zwykłych gnomach / od poziomu / zachowanie): Garden Gnome 1 / 1 / posąg, obudzony łazi i klnie; Blue Gnome 1 / 1 / jak Garden; Golden Gnome 100 / 1 (rzadki, 0,4% +0,4% za Gold Fever, 3% od poziomu 9) / ucieka; Greedy Gnome 3 / 2 / kradnie monety z ziemi i ucieka z nimi, zjedzony oddaje łup; Boom Gnome 3 / 2 (1,5% spawnów) / chodzi, zjedzony wybucha i odrzuca gnomy do 4 m od krawędzi dziury (8 m/s); Angry Gnome 4 / 3 / szarżuje, pluje, odrzuca gracza; Dwarf Gnome 8 / 4 / mały, szybki, ucieka; Saboteur Gnome 6 / 5 / idzie do maszyn i je psuje (patrz bezpieczniki); Shadow Gnome 66 / 6 / tylko nocą, patrzy z lasu, po 45 s kradnie 5% kasy; Gnome Wizard 25 / 7 / odrzuca do 8 gnomów od dziury, teleportuje się; Fat Gnome 20 / 8 / ciężki (6x masa), zawsze heavy lub massive; King Gnome 1000 / event od poziomu 10 / boss, 40 kg, tylko maszyny i traktor.
- Wagi (jednakowe dla typów): normal 1,2 kg (x1), heavy 2 kg (x1,6 kasy i XP, większy), massive 3 kg (x2,3). Cięższe pojawiają się częściej na wyższych poziomach, massive od poziomu 4. Nie ma gnomów poniżej 1 kg. Rzut daje każdemu ten sam impuls, więc cięższy leci krócej.
- Ucieczka: chodzący gnom bliżej niż 4 m od gracza ucieka 6 m od niego (szybkość typu x1,3 x waga: normal 1, heavy 0,75, massive 0,55), uspokaja się 2 s po tym, jak gracz odejdzie ponad 6 m. Posągi, leżące, trzymane i wściekłe nie uciekają. Król cofa się powoli (x0,4) i dalej tupie.
- Złota godzina (event, 25 s): każdy wolny gnom poza królem zmienia się w złotego (x100), nowe z fabryki też; po evencie wracają do swoich typów.
- Posągi budzą się losowo (Gnome Glue zmniejsza o 15% na poziom). Lądowanie: kurz, dźwięk, zgniecenie. Rzucony gnom krzyczy ponad 10 m/s. Trzymany gnom wierci się i gada; kula z ponad 3 gnomami milczy.
- Album: w legendzie (L) karta typu odkrywa się po pierwszym zjedzeniu, licznik zjedzonych, nagłówek „N/12 discovered”. Pierwsze zjedzenie typu daje jeden komunikat. Album przeżywa odrodzenie.
- Limit: 320 gnomów na planszy (Gnome Permit 5 x 40 + baza), fizyka trzyma ok. 450.
- Ruch: Garden Gnome jest zbudowany z ruchomych części (nogi, ręce, czapka, broda). Idący gnom buja się na boki i przechyla z każdym krokiem, a czapka dogania przechył z opóźnieniem. Dłuższe, grubsze ręce odstają od tułowia i przy każdym wymachu do tyłu odchylają się na zewnątrz. Inne typy bujają się tak samo i mają te same ręce, ale ruszają się jako jedna bryła.

Decyzje:
- (PP, 2026-10-19) Kilka stałych klas wagi niezależnych od typu; waga liczy się tylko przy rzucie (magnes podnosi każdą).
- (PP, 2026-10-19) „Wywalamy wszystkie gnomy poniżej kilograma, lecą zbyt daleko”.
- (PP, 2026-10-19) Golden Hour ma zamieniać wszystkie gnomy w złote i złote mają być drogie (x100 zostaje).
- (PP, 2026-10-19) Gnomy pojawiają się tylko z fabryki (bez posągów na starcie); deszcz gnomów zrzuca tylko typy specjalne.
- (sesja, 2026-10-20) Wściekłe gnomy nie uciekają (ucieczka zabiłaby szarżę); Boom Gnome wybucha tylko zjedzony, nie po kopnięciu; w paradzie nie ma Boom Gnomów.
- (sesja, 2026-10-20) Usunięte gnomy dostają stan `gone`: bo robot czytał ciało usuniętego gnoma (Golden Hour, UFO, chciwy) i gra zawieszała się z „recursive use of an object”.
- (PP, 2026-10-20) Najpierw zwykłe gnomy widziane od tyłu: bujanie i ruch rąk („nie zrob najpierw zwykle gnomy od tylu”, „skup sie na bujaniu i ruchu rak”). Powód: gracz widzi gnomy głównie od tyłu, z 6-10 m, kiedy przed nim uciekają, a dawne ręce i bujanie były stamtąd niewidoczne. Nogi, tempo kroku i części dla innych typów czekają na ocenę PP tej wersji.

### Gracz i narzędzia ręczne

- Ruch: WASD, Shift sprint, Space skok (podwójny z Gnome Boots), mysz patrzy (pointer lock po kliknięciu). Po Esc kursor bywa wolny (ukryty nad grą): mysz nadal obraca widok, ale tylko do krawędzi okna; klik albo W/A/S/D/Space/Shift przechwytuje kursor. Czułość i odwrócenie osi Y w ustawieniach.
- Mysz pod blokadą kursora używa surowego ruchu bez przyspieszenia systemu, gdy przeglądarka to umie (w Chrome suwak czułości może wymagać ponownego ustawienia); inaczej zwykły ruch. Gra nie wycina żadnego ruchu myszy, tylko zapisuje pojedyncze skoki powyżej 250 px i wolne klatki przy fabryce (najwyżej 5 + 5 na wczytanie strony): w konsoli przeglądarki jako `[gnome] mouse-jump …` i `[gnome] slow-frame …`, a na komputerze deweloperskim także w `logs/errors.log`. Decyzja (sesja, 2026-10-21, rekomendacja planu do prośby PP „Mysz przeskakuje dziwnie przy faktory”, do potwierdzenia przez PP): wycinanie skoków zjadałoby też szybki obrót ręką na myszy 125 Hz, więc najpierw pomiar z gry PP, potem ewentualny filtr.
- Ręce (LMB trzymany): podnosi JEDNĄ rzecz: gnoma (każdą wagę, bez króla), skrzynię albo fotel/flaminga; zasięg 7 m + 1,2 m za Magnet Dish. Puszczenie LMB upuszcza. RMB rzuca natychmiast (Strong Arm +15% siły na poziom).
- Magnet Gun ($300, zakładka Magnet): dziś po kupnie LMB zawsze działa jak pistolet. Trzymany LMB ściąga naraz wszystkie gnomy ze stożka do kuli przed graczem; nie ma promienia. Kula 0,8 m + 0,2 m za Magnet Coil, mieści 22 / 75 / 145 gnomów (Coil 0 / 5 / 10); reszta czeka na ziemi, aż zrobi się miejsce. Zasięg 7 m + 1,2 za Dish + 0,6 za Coil. Ciężkie gnomy łatwiej spadają z kuli przy obrocie. RMB rzuca całą kulę (salwa). Pistolet widać w prawym dolnym rogu, kula to chmura iskier w rozmiarze kuli, odrzut przy rzucie. Skrzynia i rekwizyty idą do ręki, nie do kuli.
- Trick Scope ($300 → $600 → $1,2k, 3 poziomy): Lvl 1: gdy gracz coś trzyma, celownik zmienia się w pierścień: zielony = trafi do dziury, złoty = trick, biały = pudło; do tego wstęga toru i pierścień lądowania na ziemi (na 5300 napis tricku stoi przy pierścieniu lądowania). Lvl 2: szkło wokół celownika nazywa trick (albo IN THE HOLE), napis nad dziurą znika. Lvl 3: szkło dodaje dystans i mnożnik, np. „LONG SHOT · 9.2 m · x5”.
- Kopnięcie F (Steel Toes +20% siły i obszaru na poziom; ten sam impuls, ciężkie lecą krócej).
- Uderzenie w ziemię J (w powietrzu): gracz spada, gnomy w promieniu 4 m podskakują i odlatują, lekko w stronę dziury; Gnome Boots: 5,5 m i 1,5x mocniej. Król nie rusza się. Nie działa na ziemi ani na traktorze. Odnowienie 1 s.
- Plow Tractor ($1500, poziom 3): klawisz C, x1,25 szybkości, bez sprintu, spych 2,6 m + 0,8 m za Wider Plow ($700 x1,7, 5 poziomów) pcha każdy gnom przed sobą, każdą wagę tak samo; król nigdy. LMB nie łapie na traktorze. Pchnięte gnomy nie liczą tricków.
- Leaf Blower ($150): klawisz C, trzymany LMB dmucha gnomami w stożku 25°, zasięg 6 m + 1,5 m za Long Nozzle ($100 x1,6, 4 poz.), siła +25% za Turbo Fan ($80 x1,6, 4 poz.), słabiej na końcu zasięgu, każda waga tak samo, król nie. Zdmuchnięte gnomy nie liczą tricków.
- Narzędzia ręczne: Ręce, Magnet Gun, Plow Tractor, Leaf Blower. Tab (trzymany): koło wyboru jak w GTA V z narzędziami ręcznymi i rzeczami do postawienia od 11. w górę (dziś Cleaning Robot); gra zwalnia do ćwierć tempa, mysz wybiera, puszczenie Tab zatwierdza. C: przełącza między narzędziem w ręce a gołymi rękami i z powrotem do tego samego narzędzia (gra pamięta ostatnie); bez wybranego narzędzia C daje Magnet Gun, jeśli kupiony. Klawisze 1-0: pierwsze 10 rzeczy do postawienia. Linia nad paskiem pokazuje, co trzymasz i co da C (np. `MAGNET GUN · C: Hands`). Każda zmiana narzędzia upuszcza to, co trzymasz. Kupno Magnet Gun wkłada go do ręki, wczytanie gry startuje z nim. Gołe ręce z kupionym pistoletem łapią jednego gnoma, ze starym zasięgiem.
  Decyzje: PP 20.10: „nie moge przelaczyc magnesu na rece” → pistolet stał się osobnym narzędziem, bo wcześniej ręce = pistolet i nie było powrotu. PP: „Rzeczy do postawienia 1-0 narzedzia pod tab w tym rece” i „Robot niech bedzie na kole wyboru” → koło trzyma narzędzia ręczne i rzeczy od 11. PP: „klawisz c -> obecne narzedzie rece i tyle tab do zmiany narzedzia” → C to tylko przełącznik narzędzie ↔ ręce, wybór narzędzia wyłącznie przez Tab. Sesja: linia „co trzymasz / co da C”, bo recenzja ostrzegła, że bez niej gracz myśli „pistolet znika”.
- 1-9, 0: wybór rzeczy do postawienia. Rzecz unosi się tam, gdzie gracz patrzy (kółko myszy = odległość), opiera się o ziemię albo o inne narzędzie, skrzynię, dom, biurko (nie o gnomy). R obraca o 45°, T przechyla o 15°, V reset, trzymany RMB obraca swobodnie, Q anuluje. Czerwony duch + BLOCKED, gdy nachodzi na coś, wystaje nad dziurę (ponad 0,15 m) albo poza płot. X podnosi postawioną rzecz, G przenosi ją z obrotem. Pierwszy wybór każdego narzędzia pokazuje raz podpowiedź z klawiszami.
- E: po kolei: dźwignia fabryki → zepsuta maszyna → biurko (sklep) → maszyna z czerwonym bezpiecznikiem. Działa też, gdy gracz trzyma ducha rzeczy do postawienia. Przytrzymany E przy fabryce kręci korbą.
- Inne klawisze: B sklep (Laptop; bez niego biurko), Esc pauza / w pauzie od razu wraca do gry / zamyka sklep, schematy i legendę i od razu wraca do gry, H panel sterowania, L legenda, K schematy, Z cofa ostatnie postawienie (do 10 s), I powtórka, M wycisza, P zrzut ekranu.

Decyzje:
- (PP, 2026-10-19) Magnes do kupienia, ściąga mnóstwo gnomów naraz, upgrade powiększa kulę („niech łapie ile wlezie, w jakimś okręgu”).
- (PP, 2026-10-19) Pistolet z magnesem w ręce i delikatna kula iskier zamiast „strasznego kółka”.
- (PP, 2026-10-20) Bez promienia magnesu, wszystko naraz: „magnes bez promienia, łapie wszystko naraz”. Sesja dodała limit dopływu do pojemności kuli, bo bez niego 150 gnomów tworzyło skorupę przed kamerą.
- (PP, 2026-10-20) Wind-up usunięty ($300 zwrotu), zamiast tego Trick Scope: „wind up nie działa poprawnie”. Miotła usunięta ($60 zwrotu): „nie jest przyjemna w użyciu”.
- (PP, 2026-10-20) Trick Scope jako poziomy celownika, kolimator na środku zamiast napisu nad dziurą.
- (PP, 2026-10-20) Koło wyboru narzędzi jak w GTA V; robot na kole, nie pod klawiszem.
- (PP, 2026-10-20) Rzeczy można kłaść na sobie („dziwne contraption”); sesja: duch nad dziurą blokowany na każdej wysokości, bo wcześniej duch w powietrzu nad dziurą przechodził.
- (sesja, 2026-10-20) Uderzenie w ziemię na J zamiast Ctrl: Ctrl+W zamyka kartę przeglądarki w trakcie gry.
- (sesja, 2026-10-20) Gnome Boots dostały zadanie (zasięg i siła uderzenia), bo za $600 nic nie dawały.
- (sesja, 2026-10-19) Rzucony gnom nie daje się złapać przez 1,5 s, bo wracał do ręki.

### Narzędzia do postawienia

Ceny: pierwszy poziom x wzrost na poziom, maksimum sztuk, wymagany poziom dziury.
- Wooden Crate: $70 za każdą, max 6. Skrzynia bez wieka, gnomy wrzucone lub wrzucone rzutem zostają w niej (12 + 6 za poziom Bigger Crate, $70, max 8 → do 60). Niesiona ręką (zawsze podnosi się, 1,5 kg), zrzut do dziury zjada wszystko naraz z premią. Skrzynia poza ogrodem wraca pod biurko. Gnomy nie przesuwają skrzyni ani rekwizytów.
- Trampoline: $100 x1,8, max 4. Odbija wzdłuż swojej normalnej; siła rośnie z ziemią (Backyard 44% starej, Dark Forest 135%). Trick TRICK x3.
- Metal Panel: $60 x1,25, max 10. Osłony, tunele, rampy; bez bezpieczników.
- Cooling Fan: $200 x1,9, max 4. Dmucha stożkiem 10 m, 55 m/s² przy wentylatorze, niezależnie od wagi, przechylony dmucha w górę. Idące gnomy przewraca tylko do 9 m, gnomy w powietrzu pcha do 10 m. Łopaty rozkręcają się i zwalniają płynnie, siła działa od razu.
  Decyzje: sesja 20.10: przewracanie do 9 m, bo na końcu strumienia gnom wstawał i od razu znów padał, leżał tam bez końca. PP 20.10: sabotażysta idący od przodu wentylatora jest odrzucany w kółko i tak zostaje („a”), bo wentylator ustawiony przodem sam się broni, to taktyka dla gracza. PP 20.10: rozkręcanie łopat to „tylko wygląd”, bo zmiana siły ruszyłaby balans maszyn.
- Conveyor Belt: $250 x1,5, max 6. Taśma 4,5 m/s wzdłuż strzałek, bandy z boku, na końcu wyrzuca gnoma 2 m dalej; przechylona = rampa.
- Kicking Wheel: $500 x2,5, max 2, poziom 4. Buty na kole, wykopuje wszystko przed sobą 20 m/s (ok. 18 m).
- Gnome Magnet: $2000, max 1, poziom 5. Odwrócone L: podstawa, słup 3,2 m, ramię 3,7 m z podkową na końcu. Ciągnie gnomy do 13 m w stronę linii pod głowicą (każdą wagę tak samo), w promieniu 1,2 m puszcza. Ramię może wisieć nad dziurą (liczy się tylko podstawa); duch pokazuje zielony pierścień, gdy głowica jest nad dziurą.
- Gnome Cannon: $4000 x2,5, max 2, poziom 6. Ładuje wchodzące gnomy i strzela do dziury (odrzut i obrót lufy animowane).
- Vacuum Tower: $8000 x2,5, max 2, poziom 8. Zasysa gnomy wokół prosto do dziury.
- Mini Black Hole: $50000, max 1, poziom 10. Zjada gnomy na miejscu za pełną wartość (Boom Gnome wybucha przy niej).
- Cleaning Robot: $400 x1,3, max 12, poziom 2 (patrz „Roboty sprzątające”).
- Fuses (bezpieczniki): $300 x1,8, max 5, poziom 5, nie stawia się. Każda maszyna i robot (bez skrzyni i panelu) dostaje skrzynkę z L zielonymi bezpiecznikami. Trafienie sabotażysty zmienia jeden na czerwony; maszyna psuje się dopiero przy trafieniu L+1. Pierwsze E na zepsutej maszynie ją naprawia i wymienia jeden bezpiecznik, każde następne E wymienia kolejny (animacja: czerwony wyjeżdża, zielony wskakuje). Spalone bezpieczniki nie zapisują się; Keep Tools zachowuje poziom Fuses. Bez Fuses maszyna psuje się przy pierwszym trafieniu i sama wraca po 30 s.
- Zepsuta maszyna: dym, nie działa, aż gracz naprawi ją E (celując w nią).
- Maszyny płacą pełną wartość, ale nie liczą tricków (gnom „rzucony przez maszynę”).

Decyzje:
- (PP, 2026-10-19) Skrzynia i jej ulepszenie po $70 („kupujesz box, sprzedajesz, kupujesz ulepszenie…”), limity x2, wentylatory mocniej.
- (PP, 2026-10-19) Trampolina, wentylator i taśma do kupienia na pierwszych poziomach za kilkaset dolarów.
- (PP, 2026-10-19) Taśmy „w ogóle nie działały”: strzałki pokazywały zły kierunek, więc gnom wyrzucony na koniec taśmy spadał; naprawione, do tego bandy i wyrzut.
- (PP, 2026-10-20) Magnes jako odwrócone L do powieszenia nad dziurą.
- (PP, 2026-10-20) Bezpieczniki jako drzewko, E wymienia czerwone na zielone, animacja jak w starych autach. Maszyna psuje się na L+1 (PP: wariant a).
- (PP, 2026-10-20) E ma naprawiać maszynę także, gdy obok stoi postawiona rzecz / gracz trzyma ducha: wcześniej w trybie stawiania E nic nie robiło.
- (sesja, 2026-10-20) Ceny Gnome Magnet $3k → $2k, Cannon $6k → $4k, Vacuum $15k → $8k, Kicking Wheel $900 → $500: bo gracz skrzyniowy i automatyczny nie mógł ich kupić przez wiele minut po odblokowaniu.
- (sesja, 2026-10-20) Ulepszenia wymagają bazy (Coil → Magnet Gun, Wider Plow → traktor, Bigger Crate → skrzynia, robot x3 → robot, dmuchawa x2 → dmuchawa, Batches → Gears, Auto Crank → Batches): bo kasa szła na ulepszenie czegoś, czego gracz nie miał. Magnet Dish bez wymogu, bo rozszerza też ręczny magnes.
- (sesja, 2026-10-20) Zrzut skrzyni, który awansuje dziurę, już nie zawiesza gry (kolejka skrzyni opróżniana przed jedzeniem).
- (sesja, 2026-10-20) Nie ma losowych kamieni i krzaków w ogrodzie: PP: „Wszystko, co się pojawia, trzeba móc wrzucić do dziury”.

### Roboty sprzątające

- Robot to maszyna z posterunkiem (słupek z kulką i pierścieniem obszaru). Jeździ po wolnych gnomach w obszarze 6 m + 2 m za Wider Area ($150 x1,6, 4 poz.), ładuje je na pakę (5 + 3 za Bigger Bed, $150 x1,6, 4 poz.), jedzie do dziury (2,5 m/s + 0,6 za Faster Motor, $120 x1,6, 4 poz.), staje 1 m od krawędzi, wywraca pakę (gnomy zjedzone: combo i kasa, bez tricków) i wraca.
- Kolejność celów: sabotażysta, potem chciwy / cień / czarodziej / wściekły, potem gnom najdłużej leżący bez ruchu (co 5 s), potem najbliższy. W trakcie jazdy robot zmienia cel na groźniejszy. Dwa roboty nie jadą po tego samego gnoma (poza sabotażystą). Król pomijany.
- Omijanie: siatka 0,5 m i wyszukiwanie drogi wokół postawionych rzeczy (szczeliny węższe niż 1,4 m zamknięte), cofanie i obejście, gdy utknie; nieosiągalny gnom porzucony; po 15 s bez postępu robot wraca na posterunek. Nie pcha narzędzi. Czeka, gdy gracz stoi przed nim.
- Gnomy w powietrzu (rzucone, odbite, dmuchnięte) ignoruje, aż wylądują.
- Dziura przykrywająca posterunek: robot sam przesuwa posterunek za krawędź. Wpadnięcie do dziury: wraca na posterunek z ładunkiem. Zepsuty: stoi. X zabiera robota (ładunek wysypuje się przy posterunku).
- Ceny: 12 robotów łącznie ok. $30k (pierwsze 4: $2,5k).

Decyzje:
- (PP, 2026-10-20) Roboty sprzątające, które w obszarze zbierają gnomy na pakę i wywracają do dziury; „niech nie będą super drogie”.
- (PP, 2026-10-20) Robotów „jest za mało”, mają chronić przed sabotażystami: limit 4 → 12, cena x1,6 → x1,3; 12 robotów daje 0-2 awarie na 60 s zamiast 12.
- (PP, 2026-10-20) Robot ma priorytetyzować groźne gnomy i te najdłużej leżące; sesja wybrała stałą kolejność bez ustawienia w UI.
- (PP, 2026-10-20) Roboty mają omijać postawione rzeczy i nie blokować się między trampolinami; sesja wybrała małe A* zamiast sił odpychających, bo rząd trampolin to wklęsła ściana.
- (PP, 2026-10-20) Roboty nie mają jeździć w kółko pod gnomami w powietrzu.
- (sesja, 2026-10-20) Robot bez dźwięku silnika, bez kółek, bez zapisu ładunku: nie było w planie.

### Fabryka

- Gracz trzyma E przy fabryce, fabryka produkuje gnomy i wystrzeliwuje je na pomarańczowy pierścień 6,5 m przed sobą (tam dobrze postawić skrzynię). Pasek postępu w HUD.
- Factory Gears ($40 x1,55, 16 poz., +15% tempa), Bigger Batches ($500 x2,5, 6 poz., +1 gnom na cykl, od poziomu 2, wymaga Gears), Auto Crank ($600 x1,5, 12 poz., od poziomu 4, wymaga Batches): fabryka pracuje sama, ok. 1 gnom na 12 s na poziom. Premium Gnomes ($50 x1,5, 20 poz., +10% kasy), Gnome Permit ($300 x1,8, 5 poz., +40 gnomów), Gnome Glue ($400 x1,8, 3 poz., posągi budzą się rzadziej).
- Dźwignia obok fabryki: E przełącza Auto Crank (żółta gałka, lampka zielona ON / czerwona OFF, napis „GNOME FACTORY · AUTO OFF”). OFF zatrzymuje tylko automat: ręczne E i eventy dalej robią gnomy. Stan zapisany; po odrodzeniu ON.
- Gra nie płaci za czas, gdy jest zamknięta: maszyny i fabryka pracują tylko przy otwartej grze.
- Rynna, cokół z guzikiem i koło zębate są twarde: gracz, gnomy i roboty nie wchodzą pod fabrykę ani w nią; roboty planują trasę wokół niej. Gnomy wychodzą z rynny tuż nad jej krawędzią i lądują tam, gdzie dotąd. Każdy gnom wychodzi z wylotu jeden po drugim co 0,05 s (seria z grzybka Chaos i Rainbow, partia z Bigger Batches, parada), a przed królem i po nim przerwa 0,4 s. Gnom, który odbije się z powrotem na rynnę albo leży na cokole, zostaje tam, aż gracz go zabierze; roboty go pomijają. Bryły cokołu i koła zębatego mają wymiary tego, co widać (cokół 1,2 m, koło okrągłe), a strefa trafienia dźwigni obejmuje gałkę w obu położeniach. Narzędzie ze starego zapisu albo ze schematu, które stałoby pod rynną, cokołem albo kołem, wraca do ekwipunku, a komunikat po wczytaniu schematu liczy je razem z pominiętymi przy dziurze.

Decyzje:
- (PP, 2026-10-20) „roboty i gnomy wchodza pod faktorke jakby jej nie bylo popraw jej hitbox”: każda widoczna część fabryki ma bryłę tej samej wielkości. (sesja, rekomendacja planu, do potwierdzenia przez PP) Gnomy zatrzymują się na ścianie, nie są odpychane od fabryki, bo zamówiony był hitbox. Biurko, dom i ozdoby nadal nie są w planie trasy robotów (decyzja z 2026-10-20 o omijaniu narzędzi).
- (sesja, 2026-10-21) Serie gnomów co 0,05 s zamiast w jednej klatce: gnomy zrobione w tej samej chwili startują jeden w drugim, rozpychają się i lądowały na rynnie albo na dachu fabryki (co czwarta seria z grzybka zostawiała gnoma na rynnie).
- (sesja, 2026-10-21) Stare narzędzie zakopane w fabryce wraca do ekwipunku, bo ruchome wystrzeliłoby z bryły, a stałe stałoby w niej; tak samo schematy omijają dziurę.
- (sesja, 2026-10-21, runda 1 review) Parada, partia i król też idą przez tę samą kolejkę co serie, bo 16 gnomów parady w jednej klatce i król w środku serii nadal zostawiały gnomy na rynnie. Król dostaje 0,4 s przerwy, bo jest 3 razy większy i przy 0,05 s następny gnom startował w nim.
- (sesja, 2026-10-21, runda 1 review) Roboty pomijają gnoma leżącego na rynnie albo cokole, bo łopata go nie sięga, a robot ponawiał go przy każdym kursie i inne gnomy czekały ok. 7 s zamiast 0,8 s. Gnomy nie są zsuwane z rynny (śliska rynna zsuwała je w kąt przy ścianie, a pchanie łamie decyzję „tylko hitbox”).
- (sesja, 2026-10-21, runda 1 review) Cokół i koło dostały bryły wielkości siatki, bo za wysoki niewidzialny cokół łapał E zamiast dźwigni, a gnomy leżały w powietrzu nad cokołem i w rogach koła.
- (PP, 2026-10-19) Fabryka na przytrzymany klawisz zamiast domków: „no gnome machine”.
- (PP, 2026-10-20) Wyłącznik automatycznej fabryki obok niej (wariant a: dźwignia, zapis stanu).
- (PP, 2026-10-20) Więcej poziomów ulepszeń w Factory i Combos („za mało na 12 lvl”): limity podwojone; Permit zostaje 5, bo 320 gnomów to granica płynności.
- (sesja, 2026-10-20) Auto Crank wzrost 1,9 → 1,5 i baza $1200 → $600: 12 poziomów kosztowało $2,95M; Glue 8 → 3 poziomy, bo przy maszynach obudzone posągi nie mają znaczenia.
- (PP, 2026-10-20) Zysk offline usunięty w całości: „wylacz to zupelnie”. PP zobaczył nad menu startowym kartę z +$271k za nieobecność i nie chce takiej wypłaty; kasa przychodzi tylko z gry przy otwartej stronie. Stare zapisy wczytują się bez zmian.

### Sklep

- Otwiera się E przy komputerze na biurku albo B z Laptopem ($150). Zakładki: PLOW, MAGNET, FACTORY, MOVEMENT, TOOLS (domyślna), COMBOS, BONUSES, LAND, DEEP (po pierwszym odłamku). Esc i B zamykają.
- Każda zakładka to drzewko: kolumna = poziom dziury, który odblokowuje węzeł (na prawo od rodzica), linie wzdłuż wymagań, świecą na niebiesko, gdy rodzic kupiony. Węzły to okrągłe odznaki: narzędzia i sprzęt mają obrazek własnego modelu 3D (rendering raz na sesję, ok. 0,15 s przy pierwszym otwarciu), ulepszenia statystyk emoji. Zielony pierścień i puls = stać cię, niebieski = masz, złoty = max, szary z kłódką = za niski poziom dziury, kreskowany = brak rodzica. Kupno „wyskakuje” odznaką. Najechanie pokazuje opis z „now / next”. Odznaka NEW na świeżo odblokowanych.
- Zielona liczba na zakładce = ile rzeczy na niej możesz kupić teraz za swoje pieniądze; bez kasy liczby nie ma; zmiana liczby pulsuje.
- Movement: Running Shoes ($20 x1,6, 5, +12%), Spring Socks ($30 x1,7, 3, +15% skoku), Gnome Boots ($600, poziom 3), Coin Magnet ($20 x1,5, 6, +1,2 m), Laptop ($150).
- Combos: Combo Window ($60 x1,6, 10), Combo Cap ($150 x1,7, 12), Combo Insurance ($2500, poziom 4), Jackpot ($6000, poziom 5).
- Bonuses: Spore Bag ($100 x1,6, 5, +30% grzybków), Long Trip ($200 x1,7, 4, +20% czasu), Gold Fever ($500 x1,8, 4), Piggy Bank ($800, poziom 2, monety same lecą do banku, chciwe nie kradną), Hole Hunger ($150 x1,7, 5, +10% XP), Four-leaf Clover ($1000 x1,9, 3, poziom 2, częstsze eventy).
- Land: łańcuch czterech ziem, kupić można tylko następną.
- Deep (za odłamki): Deep Value (+20% kasy, 10 poz.), Head Start (kasa na start, 5), Keep Tools (8 odłamków: zachowuje całą zakładkę Tools plus traktor, Wider Plow, dmuchawę i jej ulepszenia), Deep Combo (+0,5x, 4), Deep Hunger (+25% XP, 6).
- Wygląd: okno „GNOME-OS SHOP” jak ciemny monitor komputera, zajmuje 96% x 92% ekranu, czcionka jak w konsoli, zakładki jak pasek zadań. W pasku tytułu „AVAILABLE: n” = ile rzeczy we wszystkich zakładkach stać gracza teraz; zielone liczby na zakładkach jak dotąd. Na dole linia statusu z ostatnim komunikatem zakupu (np. „Press 3 to place it”). Przy otwarciu ekran „włącza się” w 250 ms, przy kupnie i zmianie zakładki już nie. Węzły 120x90 z ikonami 60 px; każda zakładka mieści się w 1280x720 bez przewijania, w 640x360 drzewko się zmniejsza i przewija.

Decyzje:
- (PP, 2026-10-20) Sklep jako drzewko umiejętności „bardziej fancy z grafikami”; PP wybrał b: obrazki 3D narzędzi, emoji dla statystyk.
- (PP, 2026-10-20) Zielona liczba nad zakładkami: „ile rzeczy można kupić (za pieniądze które masz)”.
- (PP, 2026-10-20) Większy sklep w stylu komputera, ciemny monitor: „zrob ten sklep wiekszym ekranem bardziej komputerowy styl”, PP wybrał ciemny monitor zamiast jasnego okna Windows, bo pasuje do ciemnych paneli gry. Sesja: animacja włączenia tylko przy otwarciu, bo przy każdym kupnie gubiłaby szybkie kliknięcia; komunikat kupna w linii statusu, bo większe okno zasłaniało komunikaty z boku.
- (sesja, 2026-10-20) Drzewko nie zmienia id, cen ani zapisu; stare zapisy zachowują poziomy, ale dziecko bez rodzica nie kupi kolejnego poziomu.

### Ziemie

- Backyard (start, płot 44 m), Garden ($1500, poziom 3, 64 m), Neighbour's Lawn ($8000, poziom 5, 88 m), Dark Forest ($40000, poziom 8, 116 m). Większy ogród, więcej miejsca, inna sceneria, mgła dopasowana do rozmiaru.
- Każda ziemia: dziura na swojej kotwicy (patrz „Dziura”), trampolina odbija mocniej (x1,25 na ziemię), limit combo +0,5.
- Narzędzia zachowane przez Keep Tools, które po odrodzeniu stałyby poza płotem Backyardu, wracają do ekwipunku.
- Trawa z wieku poziomów żółknie; nie ma losowych kamieni ani żywopłotów.

Decyzje:
- (PP, 2026-10-19) Każdy poziom ma zmieniać krajobraz i odsuwać dziurę; sesja: 1,2 m na poziom.
- (PP, 2026-10-20) Jedna trampolina była za dobra: siła odbicia zależy od ziemi.
- (otwarte, PP) Czy dziura ma stać bliżej fabryki na kolejnych ziemiach: pytanie czeka na odpowiedź PP.

### Eventy i pogoda

- Losowe eventy od poziomu 2 (Four-leaf Clover częściej): GNOME RAIN (deszcz specjalnych gnomów), GOLDEN HOUR (25 s, wszystko złote), GNOME PARADE (konga, x3), GUSTY WIND (od 3, boczny wiatr 30 s na rzucone gnomy, strzałka w HUD), OVERTIME (fabryka szaleje 20 s, x1,5), HOLE BURP (fontanna monet), MUSHROOM BLOOM, EARTHQUAKE (wszystko zsuwa się do dziury), GNOME UPRISING (od 3, wszystkie wściekłe 20 s), GNOMENADO (od 3, 20 s: tornado idzie krzywą obok dziury, podnosi do 12 gnomów na 4-7 m i część wrzuca do dziury; rzucony przez gracza gnom zachowuje AIR), CLOSE ENCOUNTER (od 4, UFO kradnie gnomy, trafione 3 rzutami daje jackpot), Night Visitor (od 6, nocą, Shadow Gnome), THE KING GNOME (od 10, 1000 zwykłych gnomów, 40 kg).
- DOWNPOUR (od poziomu 3, co 4-7 min, 45 s): trawa i gnomy śliskie (gnom pchnięty 8 m/s sunie 18 m zamiast 2 m), ciemniej, smugi deszczu. Nie mylić z GNOME RAIN.
- Dzień i noc od poziomu 6, cykl 240 s. Nocą czapki gnomów świecą; na jakości Low wygląd zostaje dzienny, ale noc liczy się dalej (Shadow Gnome przychodzi).
- Grzybki (wypadają z gnomów, Spore Bag częściej, Long Trip dłużej): Red Combo Cap (+3 do limitu combo, combo rośnie x2), Blue Zoomies (szybkość i skok), Purple Chaos (wysyp gnomów, x2), Gold Midas (następne 15 gnomów x5), Green Grog = BOOZED (ekran się chwieje, x3), Rainbow Shroom (wszystko + deszcz gnomów).
- Kontrakty: po pierwszym celu (albo po 2 min) panel z jednym zadaniem na czas: nakarm N gnomów (60 s), 3 LONG SHOT, 5 AIR, BULLSEYE, pełna skrzynia, król traktorem, combo 15/30/60, HEAVY HAUL (od poziomu 4). Nagroda 25 x (1 + Batches) x mnożnik, trudne x1,5, wypłacana fontanną monet; porażka = nowy kontrakt po 10 s. Niemożliwe kontrakty nie są losowane. Nie zapisuje się.
- Cele (panel GOAL): dwa tory. GOAL to kamienie milowe: samouczek (zrób gnomy, złap, nakarm dziurę, zbierz monety, combo 5, kup ulepszenie, poziom 2), potem poziomy dziury i The Deep; żaden nie wymaga rzutu ręką. Cel ziemi: kup Garden (Shop → Land), osobny wpis między poziomem 4 a 6. LESSON to lekcje, od razu po „Collect coins”: jedna mechanika na lekcję (grzybek, chciwy, ciężki, wściekły, krasnal, bomba, sabotażysta, złoty, czarodziej, gruby i król gnom, ciężki transport, skrzynia, combo 15, LONG SHOT, AIR, TRICK, BULLSEYE), każda czeka na poziom dziury, na którym jej rzecz może się pojawić. Każda odblokowana lekcja liczy się równolegle, panel pokazuje pierwszą niezrobioną (typy gnomów przed trickami); gdy nic nie jest odblokowane, panel pisze „Next lesson at hole level N”. Lekcje zrobione w jednej klatce płacą razem jednym komunikatem. Podczas lekcji o grzybku następny zjedzony gnom na pewno wypluwa grzybka, gdy żaden nie leży na trawie, i ten grzybek nie ląduje w postawionym narzędziu (gracz nie sięgnąłby go nogami); liczy się tylko grzybek podniesiony nogami (kod BOOZE nie). Każdy cel i lekcja płaci raz, także po odrodzeniu i dla starych zapisów. Strzałka do celu na krawędzi ekranu (po poziomie 2 wskazuje cel lekcji, np. skrzynię lub trampolinę).
- Sekrety: fotel i flaming do dziury (pełna stawka raz, potem 10%), złota łopata na skraju lasu (+10% na zawsze), kod BOOZE (tryb BOOZED), kod GNOMERAIN, szepty dziury przy awansie, 26 osiągnięć z komunikatami (Gnome Baron za $100m).

Decyzje:
- (sesja, 2026-10-20) Baner deszczu to DOWNPOUR, nie RAIN, żeby nie mylił się z GNOME RAIN; tarcie 0,04/0,06 zamiast planowanych 0,1/0,15, bo gnom nie sunął 15 m.
- (sesja, 2026-10-20) Kontrakt HEAVY HAUL liczy tylko massive (gra nie liczy heavy); kontrakt combo losowany tylko bez trwającego combo.
- (sesja, 2026-10-20) Gnome Baron za $100m zamiast $1b: $1b było poza zasięgiem.
- (sesja, 2026-10-20) Legenda opisuje tricki, nastroje, deszcz i slow-mo słowami, bez liczb: liczby to prywatne stałe i kopia rozjechałaby się po balansie.
- (PP, 2026-10-20) „pierwsze gole pokazywaly mechaniki gry mushrooms, mnozniki, gnomy”, decyzja „Od pierwszej minuty, grzybek pewny”: lekcje startują po „Collect coins”, a grzybek z lekcji jest pewny, bo losowo gracz czekałby średnio 40 gnomów.
- (sesja, 2026-10-20) LONG SHOT jest lekcją, nie kamieniem milowym: liczy się tylko rzut ręką, więc gracz grający maszynami utknąłby na nim i nie zobaczyłby celów poziomów (ten sam błąd, który naprawił podział na dwa tory). Mnożnik w samouczku uczy combo 5, które da się zrobić bez rzutu.
- (sesja, 2026-10-20) Lekcje liczą się równolegle, typy gnomów przed trickami: rzadki gnom albo trick, którego gracz nie umie, blokuje tylko własną linię. Stary zapis z wieloma już spełnionymi lekcjami dostaje jedną wypłatę i jeden komunikat zamiast serii.
- (sesja, 2026-10-20) Stare zapisy w środku samouczka dostają combo 5 jako zrobione bez wypłaty: wypłata dałaby pieniądze za cel, którego gracz nie widział.

### Interfejs

- HUD: pieniądze (prawy górny róg, puls przy tricku), poziom dziury z paskiem XP i liczbami, combo z pierścieniem czasu (prawa strona), panel magnesu / pistoletu (lewy dół: co trzymasz, waga, ile warte), linia narzędzia nad paskiem (TRACTOR · plow 2,6 m (C)), pasek narzędzi 1-0 (dół), wielkie napisy na środku (tricki, combo, STRIKE, CONTRACT DONE), banery eventów u góry, podpowiedź pierwszego użycia narzędzia (dół środek), celownik / Trick Scope, panel sterowania H po prawej pod pieniędzmi (sam przez pierwsze 20 s gry; gdy jest otwarty, combo schodzi niżej), „H controls · L legend” w rogu.
- Lewa kolumna (jedna, nic w niej na siebie nie nachodzi): GOAL, pod nim CONTRACT, pod nim karta EFFECTS w tym samym stylu (grzybki z czasem, Midas x3 z liczbą gnomów, Golden Hour, OVERTIME, wiatr ze strzałką), pod nią komunikaty: najnowszy na górze, najwyżej 4 naraz (piąty wypycha najstarszy z animacją), ten sam komunikat drugi raz dostaje „×2”, osiągnięcia też tu (złota ramka). Karty wjeżdżają i zjeżdżają w 0,3 s, reszta kolumny płynnie się przesuwa. Kolumna kończy się nad panelem magnesu; gdy brakuje miejsca, znikają najstarsze komunikaty. Na małym oknie (wysokość do 480 px) panele są ściśnięte, przy szerokości do 700 px kolumna ma 210 px, a pasek dziury, linia narzędzia, podpowiedź i baner przesuwają się na prawo od niej. Przy otwartym sklepie lub menu panele GOAL / CONTRACT / EFFECTS chowają się, komunikaty (np. „📸 saved”) zostają na wierzchu.
- Dolny rząd (panel magnesu, pasek narzędzi, linia narzędzia) nigdy na siebie nie nachodzi: pasek narzędzi stoi między panelem magnesu a takim samym marginesem po prawej, a kafelki zmniejszają się, gdy brakuje miejsca (1280x720 z 10 narzędziami: 58 px zamiast 66). Przy szerokości do 700 px panel magnesu ma szerokość kolumny i bez linii z klawiszami (są w panelu H), a pasek narzędzi stoi na prawo od niego z małymi kafelkami (640x360: 37 px) i mieści się w oknie także z robotem (11 kafelków).
- „Crate full!”: zielony napis nad samą skrzynką w chwili, gdy się zapełni (nie komunikat w kolumnie).
- Sklep: wiadomość o zakupie tylko w pasku stanu na dole okna, bez komunikatu w kolumnie.
- Menu startowe: START, „What's new (data)” (changelog z pliku, wbudowany w build), „Daily challenge <data>”. Menu pauzy (Esc): Resume, Achievements, Leaderboard, Graphics Low / Medium / High, Mouse sensitivity, Invert Y, Volume, Mute (M), Reset save (dwa kliknięcia). Esc wraca do gry od razu, bez dodatkowego kliknięcia; RESUME w menu pauzy działa jak Esc. Gdy przeglądarka odmówi przechwycenia kursora (Chrome i Brave robią tak po Esc), gra i tak biegnie z wolnym kursorem i małym napisem „Click or press W to capture the mouse” pod paskiem dziury (tam nie zasłania linii narzędzia, podpowiedzi ani lewej kolumny; tylko w bardzo niskim oknie, około 360 px, nachodzi na podpowiedź pierwszego użycia narzędzia, bo nie ma tam wolnego miejsca, a napis znika przy pierwszym ruchu); dowolny przycisk myszy lub W/A/S/D/Space/Shift go przechwytuje. Z wolnym kursorem działa wszystko poza przyciskami myszy (pierwsze naciśnięcie tylko przechwytuje, nic nie rzuca), także koło narzędzi (Tab); kursor, który wyjdzie poza okno i wróci z drugiej strony, nie obraca widoku skokiem; utrata fokusu okna pauzuje grę. Trzymany Esc nie miga pauzą. Esc w rankingu otwartym z pauzy wraca do menu pauzy.
- Legenda L (pauzuje): zakładki Gnomes (album, tabela wag), Mushrooms, Tools (tabela klawiszy, wszystkie ulepszenia z poziomem i ceną), Mechanics (poziomy dziury, ziemie, combo, tricki, STRIKE, eventy, kontrakty, nastroje, deszcz, slow-mo, odrodzenie).
- Schematy K (pauzuje): 3 sloty SAVE / LOAD / CLEAR. LOAD usuwa postawione rzeczy i odbudowuje zapisane wokół obecnej dziury (rzecz, która wpadłaby do dziury, jest pomijana z komunikatem). Z cofa ostatnie postawienie w ciągu 10 s. Schematy przeżywają odrodzenie; w daily nie nadpisują slotów ogrodu.
- Powtórka I: odtwarza ostatnie 10 s gnomów i kamery przy zamrożonej grze, potem wraca dokładnie do stanu na żywo (monety, roboty, cząstki stoją). I lub Esc przerywa. Stały bufor 12,3 MB.
- Tablica wyników (menu pauzy, i przy odrodzeniu „SUBMIT YOUR RUN”): imię i nazwisko (1-24 znaki, litery każdego alfabetu, bez HTML), top 10 (50 zapamiętanych), zakładki ALL-TIME i DAILY. Wspólna tablica online (Supabase) gdy build ma `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` i `VITE_SUPABASE_SALT`; bez nich albo gdy serwis nie odpowiada, tablica lokalna z komunikatem. Wynik zawsze zapisuje się najpierw na komputerze gracza. Online stopka mówi „Names are shown publicly online”, a pola imienia nie podpowiadają danych z przeglądarki. Klucz jest publiczny: każdy może wysłać dowolny wynik w granicach sprawdzeń bazy; baza przyjmuje najwyżej 30 wyników na minutę na jedną tablicę i najwyżej 2000 nowych wyników na dobę na wszystkich tablicach razem.
- Daily challenge (`?daily`): 5 minut, ta sama mapa i te same gnomy z fabryki dla wszystkich w danym dniu (data UTC), własna lista wyników (lokalnie 7 dni trzymane; online wszystkie dni, wysyłka tylko na dzisiejszą lub wczorajszą datę UTC), nie dotyka zapisu ogrodu, bez Reset save.
- Okienko błędów: pierwszy błąd (ramka, odrzucona obietnica, utrata WebGL) pokazuje ramkę w lewym dolnym rogu z treścią, buildem, przyciskiem Copy; kolejne tylko „+N more”. Ostatnie 5 błędów w localStorage; każdy błąd leci też na serwer deweloperski do `logs/errors.log`.
- Zrzut ekranu P: zapisuje cały ekran (gra + HUD + sklep + menu, z kolorami BOOZED) jako PNG i JSON (kasa, poziom, narzędzie, fps, widoczny tekst) do `logs/shots/<czas>.png` na komputerze serwującym grę; komunikat „saved” albo powód. Tylko dev/preview.
- Changelog: `CHANGELOG.md`, najnowszy build na górze, każdy wpis mówi, co testować.
- Grafika: malarskie tekstury CC0 (612 KB), wydeptany pierścień i ścieżka od fabryki, jasne niebo z mgłą, dłuższe cienie, gnomy 1516 trójkątów. Cząstki gasną przed recyklingiem, drżenie kamery z szumu (max 0,05 rad, 0,6 s). Rysowanie interpolowane między krokami fizyki (płynne na 120 Hz). Pauza i ukryta karta nie renderują. Limit 60 fps. Jakość: Low (ratio 1, bez cieni), Medium (1,5, cienie 1024), High (2, cienie 2048); `?lowfx` wymusza Low.

Decyzje:
- (PP, 2026-10-19) Esc ma wchodzić do menu pauzy i z niego wychodzić, to samo ze sklepem.
- (PP, 2026-10-20) „klikam esc i wracam do gry, nie musze nic dodatkowo klikac”, tak samo w sklepie. Przeglądarka nie oddaje kursora po samym Esc (Esc nie liczy się jako gest gracza), więc gra nie czeka na kursor: biegnie z wolnym kursorem, a pierwszy klik albo klawisz ruchu go przechwytuje (PP wybrał 1a: klawisze ruchu też przechwytują; 2a: utrata fokusu pauzuje, żeby gra i licznik daily nie biegły bez gracza). Kursor jest ukryty nad grą, żeby nie zasłaniał celownika. Koło narzędzi działa z wolnym kursorem, bo wolny kursor to gra (wcześniejsze „Tab bez locka → brak koła” znaczy teraz „Tab w pauzie → brak koła”).
- (PP, 2026-10-19) HUD magnesu „straszny”: pistolet w ręce, kula iskier.
- (PP, 2026-10-20) Changelog w menu startowym z pliku, „żebym wiedział co testować”.
- (PP, 2026-10-20) Zapis błędów „gdziekolwiek, byle najprościej”: plik na komputerze serwującym; okienko z Copy, bo „miałem crash gry ale nic się nie wyświetliło”.
- (PP, 2026-10-20) Klawisz do zrzutów robi PNG lokalnie; „niech interfejs będzie częścią gry, a nie osobno” (cały ekran, nie sama scena 3D). Sesja dodała zależność `html-to-image`, bo przeglądarka nie umie narysować DOM na kanwie.
- (PP, 2026-10-20) Legenda pod klawiszem o gnomach, grzybkach i mechanikach; tablica wyników z imieniem i nazwiskiem; ustawienia dźwięku i myszy w ciasteczkach.
- (PP, 2026-10-20) „Spróbuj wygładzić grafikę, bo jest toporna” i „trzeba poprawić tekstury”: kierunek „czyste światło”, styl malarski, gnomy bez tekstur.
- (PP, 2026-10-20) Komunikaty w jednej kolumnie po LEWEJ, w stylu wyzwań: „panel wyzwań po lewej wraz z wszystkimi komunikatami”, bo efekty grzybków chowały się pod wyzwaniem; „Komunikat że skrzynka pełna wyświetlaj nad skrzynką”.
- (sesja, 2026-10-20) Panel sterowania H przeniesiony na prawo pod pieniądze, bo stał na środku lewej krawędzi, dokładnie tam, gdzie teraz rośnie kolumna.
- (sesja, 2026-10-20) Zakup w sklepie nie robi już komunikatu: pasek stanu sklepu mówi to samo, a komunikat na wierzchu zasłaniał drzewko na małym oknie. Inne komunikaty (np. zrzut ekranu P) dalej pokazują się nad sklepem.
- (sesja, 2026-10-20) Komunikaty znikają po 4,2 s także w pauzie (jak dotąd), bo kupno już ich nie tworzy, a zamrożony komunikat wisiałby nad sklepem lub menu.
- (sesja, 2026-10-20) Na oknie 640 px szerokości panel H (otwierany ręcznie) zasłania prawą połowę ekranu, także baner, podpowiedź i combo; nie ma tam miejsca na wszystko naraz.
- (sesja, 2026-10-20) Pasek narzędzi zmniejsza kafelki zamiast łamać się na dwa rzędy, bo drugi rząd wszedłby na linię narzędzia i podpowiedź nad paskiem; na wąskim oknie panel magnesu traci linię z klawiszami, bo inaczej wchodziłby pod kolumnę komunikatów (PP: „tak aby nic na siebie nie nachodzilo”). Okienko błędów dalej może zasłonić dolny rząd: to nakładka na błąd i ma być na wierzchu.
- (sesja, 2026-10-20) Album odkrywa typ dopiero po pierwszym zjedzeniu (zamiast od poziomu dziury); gnomy z maszyn też się liczą.
- (sesja, 2026-10-20) Powtórka zamraża monety, skrzynie, roboty i cząstki (tylko gnomy i kamera), bo to one mają bufor.
- (sesja, 2026-10-20) High ma cienie 2048 i podwojony promień rozmycia, bo three r186 nie ma PCFSoft.
- (PP, 2026-10-20) Wspólna tablica wyników na Supabase („2.a”), bo gra zostaje statyczna na GitHub Pages: przeglądarka rozmawia z bazą bezpośrednio, Actions tylko buduje.
- (PP, 2026-10-20) Każdy wynik ma pole `key` (HMAC wyniku, tablicy i daty UTC), a baza odrzuca wiersz bez pasującego klucza, żeby przypadkowe śmieci wysłane ręcznie nie trafiały na tablicę. Sekret jest w JS gry, więc nie zatrzyma kogoś, kto przeczyta kod.
- (rekomendacja, 2026-10-20, do potwierdzenia przez PP) Limit 30 wyników na minutę osobno na każdą tablicę: zalew jednej tablicy nie blokuje zapisu na pozostałych. Sam ten limit nie chroni bazy: skrypt zalewający trzy otwarte tablice wypełniłby darmową bazę w 2-4 tygodnie.
- (rekomendacja, 2026-10-21, do potwierdzenia przez PP rano, opcja a) Najwyżej 2000 nowych wyników na dobę na wszystkich tablicach razem, a wszystkie zapisy czekają w kolejce na jedną blokadę, więc oba limity są dokładne także przy jednoczesnych wysyłkach. Pełna darmowa baza przechodzi w tryb tylko do odczytu dla wszystkich, a zalew przy tym limicie wstrzymuje zapis online najwyżej na dobę (gracze dalej zapisują lokalnie).
- (rekomendacja, 2026-10-20, do potwierdzenia przez PP) Online tylko dzisiejsza i wczorajsza tablica DAILY (UTC): bez tego skrypt obszedłby limit, zmyślając daty; wczoraj dozwolone dla gry skończonej po północy.
- (rekomendacja, 2026-10-20, do potwierdzenia przez PP) Stopka „Names are shown publicly online” i wyłączone podpowiadanie imienia, bo online nazwisko widzi każdy, a gracz nie może go sam skasować.
- (sesja, 2026-10-20) Serwer deweloperski zawsze używa tablicy lokalnej, żeby testy agentów nigdy nie pisały na prawdziwą tablicę; codzienna akcja GitHub odpytuje bazę, bo darmowy projekt usypia po cichym tygodniu.

### Zapis, ustawienia

- Zapis gry w localStorage: autozapis co 10 s i przy zamknięciu karty; Reset save w menu pauzy. Zapis trzyma kasę, ulepszenia, poziom dziury, ziemię, postawione rzeczy (z pełnym obrotem), statystyki, sekrety, widziane podpowiedzi, stan dźwigni; nie trzyma spalonych bezpieczników, ładunku robotów, kontraktu, pogody, nastroju.
- Stare zapisy: usunięte ulepszenia zwracają kasę raz (Wind-up $300, Push Broom $60) z komunikatem; Gnome Glue powyżej 3 obcina się do 3; brak nowych pól = wartości domyślne.
- Ustawienia w ciasteczku `gnome_settings` (rok, SameSite=Lax), niezależne od zapisu i od Reset save: głośność, wyciszenie, czułość myszy, odwrócenie Y, jakość grafiki. Zepsute ciasteczko = domyślne.
- Odrodzenie (The Deep): odłamki = 5 + pierwiastek(zarobione / 20000) + zjedzone w tym biegu / 2000. Zeruje kasę, ulepszenia, poziom dziury, ziemię; zostają odłamki, ulepszenia Deep, album, schematy, osiągnięcia, podpowiedzi, ustawienia; Keep Tools zachowuje narzędzia. Auto Crank po odrodzeniu włączony.

Decyzje:
- (PP, 2026-10-20) Ustawienia dźwięku i myszy w cookies, mają przeżyć Reset save.
- (sesja, 2026-10-20) Czułość myszy skalowana raz, w wejściu (nie w zapisie), żeby nie podnosić do kwadratu.
- (sesja, 2026-10-20) M wycisza tylko, gdy w ciągu 0,4 s nie ma innych liter, bo kod GNOMERAIN zawiera M.
- (sesja, 2026-10-20) Monety w locie podczas odrodzenia idą do starego biegu (max 0,5 s monet).

### Technika dla testera

- Build do grania: `npx vite build --outDir release --emptyOutDir`, serwowany `npx vite preview --outDir release` na porcie 5300 w sieci lokalnej. Nazwa builda = `release/assets/index-<hash>.js`, widać ją w okienku błędów i w JSON zrzutu.
- `logs/errors.log`: jedna linia JSON na błąd (czas, przeglądarka, url, treść, stos, build). Działa na dev i preview. `logs/shots/`: zrzuty z P (po buildzie). `logs/` jest w `.gitignore`.
- URL: `?lowfx` (jakość Low bez zapisu wyboru), `?daily` / `?daily=YYYY-MM-DD`.
- Testy: brak frameworka jednostkowego; scenariusze w headless Chromium przez CDP na serwerze deweloperskim 5199, w DEV gra wystawia `window.gnome`. Testy renderują na GPU Metal (60 fps zamiast 7); `SW=1` wraca do SwiftShader.
- GitHub Pages: `.github/workflows/deploy.yml` (build → Pages), `base` z `VITE_BASE` (w workflow `/gnome-disposal-inc/`), build pod `/` dalej działa.
