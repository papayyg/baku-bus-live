import { isLang, type Lang, langOf, plural } from "@shared/i18n.ts";
import { create } from "zustand";

export { LANGS, type Lang, langLabel } from "@shared/i18n.ts";

type Dict = {
    appTitle: string;
    tabs: { board: string; nearby: string; search: string };
    back: string;
    loading: string;
    retry: string;
    language: string;
    sameAsTelegram: string;

    min: string;
    hereHero: string;
    hereRow: string;
    arrivingHero: string;
    arrivingRow: string;
    atTime: (time: string) => string;
    notRunningHero: string;
    thenList: (list: string) => string;
    noConnection: string;
    stopsAway: (n: number) => string;
    towards: (place: string) => string;

    myTrips: string;
    emptyTitle: string;
    emptyText: string;
    stopsNearby: string;
    findByName: string;
    stops: string;
    alerts: string;
    alertOnce: (min: number, until: string) => string;
    alertDaily: (min: number, days: string, window: string) => string;
    turnOff: string;
    confirmAlertOff: string;
    days: { every: string; weekdays: string; weekends: string };
    weekdaysShort: [string, string, string, string, string, string, string];

    saved: string;
    saveTrip: string;
    notify: string;
    removeFromTrips: string;
    confirmRemoveTrip: (line: string) => string;
    fullRoute: (line: string) => string;
    tripName: string;
    waitingAtTerminus: string;
    scheduled: string;
    next: string;

    stopSaved: string;
    rename: string;
    giveName: string;
    saveStop: string;
    confirmRemoveStop: string;
    noBusesToStop: string;
    notRunningNow: string;
    stopName: string;
    route: (line: string) => string;

    routeTo: (place: string) => string;
    busesOnRoute: (n: number) => string;
    noBusesOnRoute: string;
    lookingForBuses: string;
    oppositeDirection: string;
    tripDuration: (min: number) => string;
    mine: string;

    nearbyTitle: string;
    updateLocation: string;
    noLocationAccess: string;
    locationFailed: string;
    noLocationAccessText: string;
    locationFailedText: string;
    openSettings: string;
    tryAgain: string;
    noStopsNearby: string;

    searchTitle: string;
    searchPlaceholder: string;
    clear: string;
    nothingFound: string;
    routes: string;

    save: string;
    reset: string;
    namePresets: string[];

    alertTitle: string;
    howEarly: string;
    when: string;
    once: string;
    regularly: string;
    from: string;
    to: string;
    daysOfWeek: string;
    alertOnceText: (line: string, min: number) => string;
    alertDailyText: (line: string, min: number) => string;
    turnOn: string;

    mapFailed: string;
    crashTitle: string;
    crashText: string;
    reload: string;

    errors: {
        transit: string;
        unauthorized: string;
        limitTrips: string;
        limitStops: string;
        limitAlerts: string;
        notFound: string;
        timeout: string;
        generic: string;
    };
};

const ru: Dict = {
    appTitle: "Автобусы Баку",
    tabs: { board: "Поездки", nearby: "Рядом", search: "Поиск" },
    back: "Назад",
    loading: "Загрузка",
    retry: "Повторить",
    language: "Язык",
    sameAsTelegram: "Как в Telegram",

    min: "мин",
    hereHero: "На остановке",
    hereRow: "здесь",
    arrivingHero: "Подъезжает",
    arrivingRow: "сейчас",
    atTime: (time) => `в ${time}`,
    notRunningHero: "Нет на линии",
    thenList: (list) => `затем ${list}`,
    noConnection: "нет связи",
    stopsAway: (n) =>
        n === 0 ? "Следующая остановка ваша" : `Ещё ${n} ${plural("ru", n, { one: "остановка", few: "остановки", many: "остановок" })}`,
    towards: (place) => `в сторону ${place}`,

    myTrips: "Мои поездки",
    emptyTitle: "Ваш автобус — одним касанием",
    emptyText: "Найдите остановку, выберите номер и сохраните поездку. Она появится здесь и кнопкой в чате с ботом.",
    stopsNearby: "Остановки рядом",
    findByName: "Найти по названию",
    stops: "Остановки",
    alerts: "Уведомления",
    alertOnce: (min, until) => `за ${min} мин · до ${until}`,
    alertDaily: (min, days, window) => `за ${min} мин · ${days} ${window}`,
    turnOff: "Выключить",
    confirmAlertOff: "Выключить это уведомление?",
    days: { every: "каждый день", weekdays: "по будням", weekends: "по выходным" },
    weekdaysShort: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],

    saved: "Сохранено",
    saveTrip: "Сохранить поездку",
    notify: "Уведомить",
    removeFromTrips: "Убрать из поездок",
    confirmRemoveTrip: (line) => `Убрать ${line} из поездок?`,
    fullRoute: (line) => `Весь маршрут ${line}`,
    tripName: "Название поездки",
    waitingAtTerminus: "Автобус ждёт на конечной",
    scheduled: "По расписанию",
    next: "Следующие",

    stopSaved: "Сохранена",
    rename: "Переименовать",
    giveName: "Дать имя",
    saveStop: "Сохранить остановку",
    confirmRemoveStop: "Убрать остановку из сохранённых?",
    noBusesToStop: "Сейчас к этой остановке никто не едет.",
    notRunningNow: "Сейчас не на линии",
    stopName: "Название остановки",
    route: (line) => `Маршрут ${line}`,

    routeTo: (place) => `до ${place}`,
    busesOnRoute: (n) => `${n} ${plural("ru", n, { one: "автобус", few: "автобуса", many: "автобусов" })} на линии`,
    noBusesOnRoute: "Сейчас на линии никого",
    lookingForBuses: "Ищу автобусы…",
    oppositeDirection: "Обратное направление",
    tripDuration: (min) => `~${min} мин в пути`,
    mine: "моя",

    nearbyTitle: "Рядом",
    updateLocation: "Обновить местоположение",
    noLocationAccess: "Нет доступа к геопозиции",
    locationFailed: "Не получилось определить место",
    noLocationAccessText: "Разрешите доступ к геопозиции или найдите остановку по названию.",
    locationFailedText: "Проверьте, что геолокация включена, и попробуйте ещё раз.",
    openSettings: "Открыть настройки",
    tryAgain: "Попробовать снова",
    noStopsNearby: "В радиусе километра остановок нет.",

    searchTitle: "Поиск",
    searchPlaceholder: "Остановка или номер",
    clear: "Очистить",
    nothingFound: "Ничего не нашлось. Попробуйте часть названия: «Нариманов», «28 May».",
    routes: "Маршруты",

    save: "Сохранить",
    reset: "Сбросить",
    namePresets: ["Дом", "Работа", "Учёба"],

    alertTitle: "Уведомление",
    howEarly: "За сколько минут",
    when: "Когда",
    once: "Сейчас, один раз",
    regularly: "Регулярно",
    from: "с",
    to: "до",
    daysOfWeek: "Дни недели",
    alertOnceText: (line, min) => `Пришлю сообщение, когда ${line} будет в ${min} минутах. Жду час.`,
    alertDailyText: (line, min) => `В выбранные дни пришлю одно сообщение, когда ${line} будет в ${min} минутах.`,
    turnOn: "Включить",

    mapFailed: "Карта не загрузилась. Нажмите, чтобы повторить",
    crashTitle: "Что-то сломалось",
    crashText: "Перезагрузите приложение — ваши поездки сохранены.",
    reload: "Перезагрузить",

    errors: {
        transit: "Сервис автобусов не отвечает. Данные обновятся сами, как только он вернётся.",
        unauthorized: "Откройте приложение из Telegram — так я пойму, чьи это поездки.",
        limitTrips: "Сохранено максимум поездок. Удалите ненужную и попробуйте снова.",
        limitStops: "Сохранено максимум остановок. Удалите ненужную и попробуйте снова.",
        limitAlerts: "Уведомлений уже 10 — больше не помещается. Выключите ненужное.",
        notFound: "Не нашёл такую остановку или маршрут.",
        timeout: "Сервер долго не отвечает. Проверьте интернет.",
        generic: "Не получилось загрузить данные. Проверьте интернет и попробуйте ещё раз.",
    },
};

const az: Dict = {
    appTitle: "Bakı avtobusları",
    tabs: { board: "Səfərlər", nearby: "Yaxınlıqda", search: "Axtarış" },
    back: "Geri",
    loading: "Yüklənir",
    retry: "Yenidən cəhd et",
    language: "Dil",
    sameAsTelegram: "Telegram-dakı kimi",

    min: "dəq",
    hereHero: "Dayanacaqdadır",
    hereRow: "burada",
    arrivingHero: "Yaxınlaşır",
    arrivingRow: "indi",
    atTime: (time) => `saat ${time}`,
    notRunningHero: "Xətdə yoxdur",
    thenList: (list) => `sonra ${list}`,
    noConnection: "əlaqə yoxdur",
    stopsAway: (n) => (n === 0 ? "Növbəti dayanacaq sizinkidir" : `Daha ${n} dayanacaq`),
    towards: (place) => `${place} istiqamətində`,

    myTrips: "Səfərlərim",
    emptyTitle: "Avtobusunuz — bir toxunuşla",
    emptyText: "Dayanacağı tapın, marşrutu seçin və səfəri yadda saxlayın. O, burada və botla söhbətdə düymə kimi görünəcək.",
    stopsNearby: "Yaxınlıqdakı dayanacaqlar",
    findByName: "Adla axtar",
    stops: "Dayanacaqlar",
    alerts: "Bildirişlər",
    alertOnce: (min, until) => `${min} dəq əvvəl · son vaxt ${until}`,
    alertDaily: (min, days, window) => `${min} dəq əvvəl · ${days} ${window}`,
    turnOff: "Söndür",
    confirmAlertOff: "Bu bildiriş söndürülsün?",
    days: { every: "hər gün", weekdays: "iş günləri", weekends: "həftə sonu" },
    weekdaysShort: ["B.e", "Ç.a", "Ç", "C.a", "C", "Ş", "B"],

    saved: "Yadda saxlanılıb",
    saveTrip: "Səfəri yadda saxla",
    notify: "Xəbər ver",
    removeFromTrips: "Səfərlərdən sil",
    confirmRemoveTrip: (line) => `${line} səfərlərdən silinsin?`,
    fullRoute: (line) => `Bütün marşrut: ${line}`,
    tripName: "Səfərin adı",
    waitingAtTerminus: "Avtobus son dayanacaqda gözləyir",
    scheduled: "Cədvəl üzrə",
    next: "Növbəti",

    stopSaved: "Yadda saxlanılıb",
    rename: "Adını dəyiş",
    giveName: "Ad ver",
    saveStop: "Dayanacağı yadda saxla",
    confirmRemoveStop: "Dayanacaq yadda saxlananlardan silinsin?",
    noBusesToStop: "Hazırda bu dayanacağa heç bir avtobus gəlmir.",
    notRunningNow: "Hazırda xətdə deyil",
    stopName: "Dayanacağın adı",
    route: (line) => `Marşrut ${line}`,

    routeTo: (place) => `${place} istiqamətində`,
    busesOnRoute: (n) => `Xətdə ${n} avtobus`,
    noBusesOnRoute: "Hazırda xətdə avtobus yoxdur",
    lookingForBuses: "Avtobuslar axtarılır…",
    oppositeDirection: "Əks istiqamət",
    tripDuration: (min) => `Yolda ~${min} dəq`,
    mine: "mənim",

    nearbyTitle: "Yaxınlıqda",
    updateLocation: "Yeri yenilə",
    noLocationAccess: "Geolokasiyaya icazə yoxdur",
    locationFailed: "Yerinizi təyin etmək alınmadı",
    noLocationAccessText: "Geolokasiyaya icazə verin və ya dayanacağı adla tapın.",
    locationFailedText: "Geolokasiyanın açıq olduğunu yoxlayın və yenidən cəhd edin.",
    openSettings: "Ayarları aç",
    tryAgain: "Yenidən cəhd et",
    noStopsNearby: "1 km radiusunda dayanacaq yoxdur.",

    searchTitle: "Axtarış",
    searchPlaceholder: "Dayanacaq və ya marşrut nömrəsi",
    clear: "Təmizlə",
    nothingFound: "Heç nə tapılmadı. Adın bir hissəsini yazın: «Nərimanov», «28 May».",
    routes: "Marşrutlar",

    save: "Yadda saxla",
    reset: "Sıfırla",
    namePresets: ["Ev", "İş", "Məktəb"],

    alertTitle: "Bildiriş",
    howEarly: "Neçə dəqiqə əvvəl",
    when: "Nə vaxt",
    once: "İndi, bir dəfə",
    regularly: "Müntəzəm",
    from: "başlanğıc",
    to: "son",
    daysOfWeek: "Həftənin günləri",
    alertOnceText: (line, min) => `${line} nömrəli avtobus ${min} dəqiqəlik məsafədə olanda mesaj göndərəcəyəm. Bir saat gözləyirəm.`,
    alertDailyText: (line, min) => `Seçdiyiniz günlərdə ${line} nömrəli avtobus ${min} dəqiqəlik məsafədə olanda bir mesaj göndərəcəyəm.`,
    turnOn: "Aktivləşdir",

    mapFailed: "Xəritə yüklənmədi. Yenidən cəhd etmək üçün toxunun",
    crashTitle: "Xəta baş verdi",
    crashText: "Tətbiqi yenidən yükləyin — səfərləriniz yadda saxlanılıb.",
    reload: "Yenidən yüklə",

    errors: {
        transit: "Avtobus xidməti cavab vermir. O qayıdan kimi məlumat özü yenilənəcək.",
        unauthorized: "Tətbiqi Telegram-dan açın — belə səfərlərin kimə aid olduğunu biləcəyəm.",
        limitTrips: "Maksimum sayda səfər yadda saxlanılıb. Lazımsızını silib yenidən cəhd edin.",
        limitStops: "Maksimum sayda dayanacaq yadda saxlanılıb. Lazımsızını silib yenidən cəhd edin.",
        limitAlerts: "Artıq 10 bildiriş var — daha çox olmur. Lazımsızını söndürün.",
        notFound: "Belə dayanacaq və ya marşrut tapılmadı.",
        timeout: "Server uzun müddət cavab vermir. İnterneti yoxlayın.",
        generic: "Məlumatı yükləmək alınmadı. İnterneti yoxlayıb yenidən cəhd edin.",
    },
};

const en: Dict = {
    appTitle: "Baku buses",
    tabs: { board: "Trips", nearby: "Nearby", search: "Search" },
    back: "Back",
    loading: "Loading",
    retry: "Try again",
    language: "Language",
    sameAsTelegram: "Same as Telegram",

    min: "min",
    hereHero: "At the stop",
    hereRow: "here",
    arrivingHero: "Arriving",
    arrivingRow: "now",
    atTime: (time) => `at ${time}`,
    notRunningHero: "Not running",
    thenList: (list) => `then ${list}`,
    noConnection: "no connection",
    stopsAway: (n) => (n === 0 ? "Your stop is next" : `${n} more ${plural("en", n, { one: "stop", many: "stops" })}`),
    towards: (place) => `towards ${place}`,

    myTrips: "My trips",
    emptyTitle: "Your bus, in one tap",
    emptyText: "Find your stop, pick a route and save the trip. It will show up here and as a button in the chat with the bot.",
    stopsNearby: "Stops nearby",
    findByName: "Search by name",
    stops: "Stops",
    alerts: "Alerts",
    alertOnce: (min, until) => `${min} min before · until ${until}`,
    alertDaily: (min, days, window) => `${min} min before · ${days} ${window}`,
    turnOff: "Turn off",
    confirmAlertOff: "Turn off this alert?",
    days: { every: "every day", weekdays: "weekdays", weekends: "weekends" },
    weekdaysShort: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],

    saved: "Saved",
    saveTrip: "Save trip",
    notify: "Notify me",
    removeFromTrips: "Remove from trips",
    confirmRemoveTrip: (line) => `Remove ${line} from your trips?`,
    fullRoute: (line) => `Full route ${line}`,
    tripName: "Trip name",
    waitingAtTerminus: "The bus is waiting at the terminus",
    scheduled: "Scheduled",
    next: "Next",

    stopSaved: "Saved",
    rename: "Rename",
    giveName: "Name it",
    saveStop: "Save stop",
    confirmRemoveStop: "Remove this stop from saved?",
    noBusesToStop: "No buses are heading to this stop right now.",
    notRunningNow: "Not running now",
    stopName: "Stop name",
    route: (line) => `Route ${line}`,

    routeTo: (place) => `to ${place}`,
    busesOnRoute: (n) => `${n} ${plural("en", n, { one: "bus", many: "buses" })} on the route`,
    noBusesOnRoute: "No buses on the route right now",
    lookingForBuses: "Looking for buses…",
    oppositeDirection: "Opposite direction",
    tripDuration: (min) => `~${min} min trip`,
    mine: "mine",

    nearbyTitle: "Nearby",
    updateLocation: "Update location",
    noLocationAccess: "No access to your location",
    locationFailed: "Couldn't find your location",
    noLocationAccessText: "Allow location access or find a stop by name.",
    locationFailedText: "Make sure location is turned on and try again.",
    openSettings: "Open settings",
    tryAgain: "Try again",
    noStopsNearby: "No stops within 1 km.",

    searchTitle: "Search",
    searchPlaceholder: "Stop or route number",
    clear: "Clear",
    nothingFound: "Nothing found. Try part of the name: “Narimanov”, “28 May”.",
    routes: "Routes",

    save: "Save",
    reset: "Reset",
    namePresets: ["Home", "Work", "School"],

    alertTitle: "Alert",
    howEarly: "How many minutes before",
    when: "When",
    once: "Now, once",
    regularly: "Regularly",
    from: "from",
    to: "to",
    daysOfWeek: "Days of the week",
    alertOnceText: (line, min) => `I'll message you when bus ${line} is ${min} minutes away. I'll keep watching for an hour.`,
    alertDailyText: (line, min) => `On the days you pick, I'll send one message when bus ${line} is ${min} minutes away.`,
    turnOn: "Turn on",

    mapFailed: "The map didn't load. Tap to try again",
    crashTitle: "Something went wrong",
    crashText: "Reload the app — your trips are saved.",
    reload: "Reload",

    errors: {
        transit: "The bus service isn't responding. Data will refresh as soon as it's back.",
        unauthorized: "Open the app from Telegram so I know whose trips these are.",
        limitTrips: "You've saved the maximum number of trips. Remove one and try again.",
        limitStops: "You've saved the maximum number of stops. Remove one and try again.",
        limitAlerts: "You already have 10 alerts — turn one off first.",
        notFound: "That stop or route wasn't found.",
        timeout: "The server is taking too long. Check your connection.",
        generic: "Couldn't load the data. Check your connection and try again.",
    },
};

export const DICTS: Record<Lang, Dict> = { az, ru, en };

const tgLang = (): Lang => langOf(window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code ?? navigator.language);

export const useLangStore = create<{ lang: Lang }>(() => ({ lang: tgLang() }));

export function setLang(lang: Lang | null): void {
    const next = isLang(lang) ? lang : tgLang();
    document.documentElement.lang = next;
    useLangStore.setState({ lang: next });
}

export const useLang = (): Lang => useLangStore((s) => s.lang);

export const useT = (): Dict => DICTS[useLang()];

export const currentT = (): Dict => DICTS[useLangStore.getState().lang];
