# sun.store – listing produktów

Zadanie rekrutacyjne (Frontend Developer): listing 150 produktów fotowoltaicznych z pliku CSV z filtrowaniem po stronie serwera, stanem w URL i SSR.

- **Aplikacja:** https://sunstoretest.vercel.app/
- **Przykładowy link z filtrami:** https://sunstoretest.vercel.app/?category=battery&manufacturer=ecocharge&specMin=7&sort=spec-desc

## Stack

Nuxt 4 · Vue 3 (Composition API) · TypeScript (strict) · Nuxt UI 4 · Nitro · Vitest · Playwright · Vercel

## Uruchomienie

Wymagany Node 24 (`.nvmrc`) i pnpm (wersja z pola `packageManager`, np. przez `corepack enable`).

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm test           # testy jednostkowe (Vitest)
pnpm test:e2e       # e2e (Playwright) na buildzie produkcyjnym
pnpm lint
pnpm typecheck
```

Na Vercelu wymagana jest zmienna `ENABLE_EXPERIMENTAL_COREPACK=1`, żeby build używał tej samej wersji pnpm co lokalnie.

## Struktura

```
server/
  assets/products.csv        # dane – bundlowane przez Nitro jako server asset
  api/products.get.ts        # GET /api/products
  utils/
    parse-products.ts        # CSV → Product (walidacja, normalizacja, id)
    extract-spec.ts          # pozyskiwanie kWh / W
    filter-products.ts       # wyszukiwanie, filtry, sortowanie, paginacja, fasety
shared/                      # kod wspólny dla serwera i klienta
  utils/product-query.ts     # URL ⇄ ProductQuery (parse, serializacja, canonical redirect)
  utils/seo.ts               # title, description, robots, canonical
app/
  pages/index.vue            # strona listingu
  composables/useProductFilters.ts
  components/                # filtry, wyszukiwarka, sortowanie, karta, paginacja
test/unit, test/e2e
```

## 1. Kluczowe decyzje

- **URL jako jedyne źródło stanu filtrów.** Nie ma osobnego store'a: strona czyta `route.query`, a każda zmiana filtra to nawigacja. Dzięki temu SSR, odświeżenie, udostępniony link i przycisk „wstecz” zawsze widzą ten sam stan.
- **Jedna funkcja parsująca URL dla serwera i klienta** (`parseProductQuery` w `shared/`). Jest celowo pobłażliwa: nieznane lub błędne wartości (`category=nope`, `page=-3`, `priceMin=abc`) są odrzucane zamiast zwracać 400, więc ręcznie edytowany albo stary link nadal działa.
- **Kanoniczne URL-e i 301.** Te same filtry zawsze dają ten sam URL (stała kolejność kluczy, bez wartości domyślnych). Niekanoniczny adres (np. `page=7` przy 3 stronach, `manufacturer=EcoCharge,Quantum Energy`) dostaje 301 na wersję kanoniczną. Parametry spoza listingu (np. `utm_*`) są zachowywane.
- **Historia przeglądarki.** Filtry dodają wpis w historii (`push`). Wyszukiwarka dodaje wpis przy rozpoczęciu lub wyczyszczeniu frazy, a przy jej doprecyzowaniu podmienia bieżący (`replace`, debounce 300 ms), więc „wstecz” cofa do poprzedniego stanu filtrów, a nie o jedną literę. Zakresy (cena, kWh/W) zatwierdzane są na blur/Enter, nie przy każdej cyfrze.
- **Fasety liczone „bez własnego filtra”.** Liczba przy producencie czy kategorii mówi, ile wyników da jej wybranie przy pozostałych aktywnych filtrach. Opcje z zerem są wyłączone, więc nie ma ślepych zaułków.
- **kWh/W tylko w obrębie kategorii.** kWh i W są nieporównywalne, dlatego filtr i sortowanie po pojemności/mocy działają tylko po wybraniu baterii lub paneli. Zmiana kategorii resetuje ten filtr.
- **Prawdziwe linki** dla kategorii i paginacji (`<a href>`): crawlery mogą po nich przejść, działają bez JS i otwierają się w nowej karcie.
- **CSV jako server asset Nitro** (`useStorage('assets:server')`) zamiast `fs.readFile`: plik jest bundlowany do funkcji serverless, więc działa na Vercelu niezależnie od struktury plików. Wynik parsowania jest cache'owany w pamięci instancji.
- **Cache CDN** dla API (`s-maxage=3600, stale-while-revalidate`): dane zmieniają się tylko przy deployu.
- **Lazy hydration** (wbudowana w Nuxt 4): karty produktów (`hydrate-never`, brak interaktywności), boczny panel filtrów (hydratowany tylko od 1024 px, na telefonie jest ukryty) i paginacja (`hydrate-on-visible`). Zmniejszyło to TBT o ok. 46% (mediana 108 → 58 ms przy tym samym buildzie).
- **Logika w czystych funkcjach** (parsowanie, kWh/W, filtrowanie, SEO), więc łatwo ją testować bez uruchamiania Nuxta.

## 2. Pozyskiwanie kWh / W

Kod: [`server/utils/extract-spec.ts`](server/utils/extract-spec.ts), testy: [`test/unit/extract-spec.test.ts`](test/unit/extract-spec.test.ts).

1. **Jednostka zależy od kategorii:** bateria → kWh, panel → W, złączka → brak (`spec: null`). Dzięki temu `15A`, `1500V` czy `8 AWG` w opisach złączek nigdy nie zostaną odczytane jako moc.
2. **Z opisu** wyciągane są wszystkie wartości z jednostką, z konwersją: `5000Wh` → 5 kWh, `0.45 kWp` → 450 W, `Wp` → W, przecinek dziesiętny (`2,5 kWh`).
3. **Z nazwy** brana jest liczba na końcu (`HomeVault 13.5`, `Prime 450`).
4. **Wybór wartości:**
   1. liczba z nazwy potwierdzona w opisie (`name+description`, najbardziej wiarygodne);
   2. w przeciwnym razie pierwsza wartość z jednostką z opisu (`description`);
   3. w ostateczności sama liczba z nazwy (`name`);
   4. inaczej `null`.

Obsłużone przypadki brzegowe:

- **Kilka wartości w opisie:** `PowerFlow Stack 7.5` – „…7.5kWh… a total of 30kWh”, `Stack 10.5` – „three 3.5kWh modules”, `AuraPower Reserve 12.5` – „five 2.5kWh modules”. Liczba z nazwy wskazuje właściwą wartość.
- **Inne jednostki i liczby są ignorowane:** `5400 Pa`, `up to 25%`, `182mm`, `30-year`, `6,000 cycles`. `kW` nie łapie się wewnątrz `kWh`, a `W` wewnątrz `Wh` (granice słowa), a liczba nie może być końcówką dłuższej liczby.
- **Wartości poza zakresem** (kWh 0.1–1000, W 1–2000) są odrzucane jako szum.

Wynik dla dostarczonych danych: wszystkie 50 baterii i 50 paneli ma wartość z najpewniejszego źródła (`name+description`), zgodną z nazwą; wszystkie 50 złączek ma `null` (test na prawdziwym CSV pilnuje tego automatycznie). Pole `source` zostawiłem w danych celowo, żeby było widać, skąd wzięła się każda wartość.

Parsowanie CSV ([`parse-products.ts`](server/utils/parse-products.ts)) używa `csv-parse` (opisy zawierają przecinki i cudzysłowy). Wiersze z brakującą nazwą, błędną ceną albo nieznaną kategorią są pomijane z podaniem powodu i numeru linii, więc jeden zły wiersz nie wyłącza listingu.

## 3. Indeksowanie kombinacji filtrów

Indeksowałbym tylko stabilne kombinacje o realnym popycie wyszukiwania: cały listing, kategorię i kategorię z jednym producentem (oraz ich kolejne strony), z self-canonical. Wszystko inne (wyszukiwanie, wybór wielu opcji, zakresy cen i kWh/W, puste wyniki) dostaje `noindex, follow`, a sortowanie canonical na wersję bez sortowania, żeby nie generować nieskończonej liczby cienkich duplikatów. Docelowo zamieniłbym indeksowane kombinacje na czytelne ścieżki (`/batteries/ecocharge`) z sitemapą i unikalnym tekstem, a o dopuszczeniu kolejnych kombinacji (np. „baterie 10 kWh”) decydowałbym na podstawie danych z Search Console.

Ta polityka jest już zaimplementowana ([`shared/utils/seo.ts`](shared/utils/seo.ts)) razem z dynamicznym `<title>`, `<h1>`, `description` (z prawdziwymi liczbami: liczba produktów, producenci, zakres cen) i tagami OG.

## 4. Czego celowo nie zrobiłem i co dalej

Celowo poza zakresem:

- **Strona produktu, logowanie, panel edycji:** zgodnie z treścią zadania.
- **Tylko jedna kategoria naraz:** upraszcza filtr kWh/W (jedna jednostka) i politykę indeksowania.
- **Ścieżki zamiast query stringów** (`/batteries/ecocharge`) i sitemap.xml: opisane w pkt. 3 jako kolejny krok.
- **Brak cache CDN dla HTML:** cache'owane jest tylko API. ISR na Vercelu domyślnie ignoruje query string, a tu cała treść zależy od query, więc wymagałoby to ostrożnej konfiguracji.
- **Brak i18n i wielu walut:** ceny w EUR, interfejs po angielsku.

Znane ograniczenia:

- **Wybrani producenci zostają przy zmianie kategorii.** Liczniki pokazują wtedy 0 dla innych kategorii, co jest poprawne, ale można by resetować producentów razem z kategorią.
- **`HEAD /api/products` zwraca 404:** endpoint jest zdefiniowany tylko dla GET.
- **Zmiana CSV wymaga deployu:** dane są bundlowane.

Z większą ilością czasu:

- Dane z prawdziwego źródła (API/baza) z indeksem wyszukiwania (np. Meilisearch/Typesense) zamiast filtrowania w pamięci: przy 150 produktach to wystarcza, przy tysiącach już nie.
- Ekstrakcja specyfikacji przy imporcie danych, z raportem produktów o niskiej pewności (`source: name`) do ręcznej weryfikacji.
- Wyszukiwanie odporne na literówki, podświetlanie trafień, sugestie.
- Więcej testów e2e (mobilny panel filtrów, paginacja) i testy wizualne.
- Monitoring Core Web Vitals z prawdziwych użytkowników (RUM) zamiast tylko Lighthouse.

## 5. Lighthouse

Strona: `/?category=battery` na produkcji, Lighthouse 12, Chrome 156 (headless), 21.10.2026. Mobile to mediana z 3 pomiarów (wynik Performance 91–94).

| | Performance | Accessibility | Best Practices | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| Mobile | **93** | **100** | **100** | **100** | 2.0 s | 2.5 s | 180 ms | 0 |
| Desktop | **100** | **100** | **100** | **100** | 0.5 s | 0.5 s | 0 ms | 0 |

Pełne raporty: [`docs/lighthouse/mobile.html`](docs/lighthouse/mobile.html), [`docs/lighthouse/desktop.html`](docs/lighthouse/desktop.html).

Uwagi:

- **Pierwszy pomiar dał na mobile 80** z powodu cold startu funkcji serverless (TTFB 11 s). Kolejne pomiary są stabilne.
- **FCP/LCP na mobile pochodzą z symulacji wolnej sieci** (RTT 150 ms, 1.6 Mbit/s). Pomiar zwykłą przeglądarką przez Performance API na produkcji dał FCP i LCP ≈ 0.6 s, także przy 4× spowolnionym CPU.

## 6. Jak korzystałem z AI

Pracowałem z Claude Code (agent w terminalu/IDE). Najpierw razem z AI rozpisałem plan na kilkanaście małych kroków, żeby historia commitów była chronologiczna. Potem AI generowało kod krok po kroku, a ja przeglądałem każdy krok i sam go commitowałem. AI sprawdzało też każdy krok: lint, typecheck, testy, `curl` na wyrenderowany HTML i klikanie w przeglądarce.

Miejsca, w których wynik trzeba było poprawić, i dlaczego:

- **`slugify` zamieniał znaki diakrytyczne na myślniki** (`Ünïcode` → `u-ni-code`). Po `normalize('NFKD')` znak diakrytyczny staje się osobnym znakiem, a regex zamieniał go na `-`. Błąd wyłapał test jednostkowy, poprawka jest w osobnym commicie `fix(data)`.
- **`UInput type="number"` zwraca liczbę, choć typy Nuxt UI mówią `string`.** `.trim()` rzucał wyjątek i filtr ceny się nie zatwierdzał. TypeScript tego nie złapał, wyszło dopiero przy klikaniu w przeglądarce.
- **Liczniki kategorii przy aktywnym filtrze kWh** pokazywały 0 dla pozostałych kategorii, bo filtr kWh był stosowany także do nich. Poprawione na „ile wyników po przełączeniu”.
- **Parametry `specMin`/`sort=spec-*` bez kategorii** były ignorowane przy filtrowaniu, ale zostawały w URL i canonicalu. Teraz parser je odrzuca.
- **Testy z błędnymi oczekiwaniami.** Dwa testy były źle napisane (kod działał poprawnie), a jeden po zmianie przechodził przypadkiem. Przepisałem je tak, żeby faktycznie sprawdzały zachowanie.
- **Nagłówek „Batteries 10 kWh–15 kWh”** poprawiony na „10–15 kWh”.
- **Diagnoza Lighthouse.** Pierwsza hipoteza („hydratacja blokuje pierwsze malowanie”) nie potwierdziła się w pomiarze zwykłą przeglądarką. Przyczyną słabego wyniku był cold start, a realnym zyskiem okazała się mniejsza praca JS (lazy hydration → niższy TBT).
- **Środowisko.** Domyślny Node w systemie (14) nie uruchamiał pnpm, a Nuxt 4.6 wymaga Node ≥ 22.21, więc projekt przypiąłem do Node 24 (`.nvmrc`, `engines`).

## 7. Czas

Około **2,5 godziny**: ok. 2 godziny implementacji (według historii commitów) plus czytanie zadania, planowanie, deploy i pomiary.
