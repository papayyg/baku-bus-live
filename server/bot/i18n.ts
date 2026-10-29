import type { Lang } from "../../shared/i18n.ts";

export { LANGS, type Lang, langOf } from "../../shared/i18n.ts";

type Dict = {
    welcomeNew: (name: string) => string;
    welcomeBack: (name: string) => string;
    help: string;
    openApp: string;
    openAppPrompt: string;
    keyboardReady: string;
    allTrips: string;
    refresh: string;
    map: string;
    stopAlerts: string;
    serviceDown: string;
    alreadyFresh: string;
    notModified: string;
    staleButton: string;
    alertOff: string;
    privateOnly: string;
    openBot: string;
    noTrips: string;
    pickStop: string;
    whichStop: (line: string) => string;
    notThroughStops: (line: string) => string;
    routeButton: (line: string) => string;
    noRoute: (line: string) => string;
    stopNotFound: string;
    searchInApp: string;
    found: (q: string) => string;
    nearby: string;
    nothingNearby: string;
    keyboardUpdated: (list: string) => string;
    keyboardRemoved: string;
    alertExpired: (line: string, stop: string) => string;
    chooseLanguage: string;
    sameAsTelegram: string;
    languageSet: string;

    bus: string;
    stop: string;
    arrivesIn: (mins: string, far: string) => string;
    nowAtStop: string;
    nowArriving: (far: string) => string;
    following: (list: string) => string;
    min: string;
    atStop: string;
    nextPlanned: (time: string, note: string) => string;
    fromTerminus: string;
    scheduled: string;
    noBuses: string;

    noConnection: string;
    notRunning: string;
    thenShort: (list: string) => string;
    at: (time: string) => string;
    alertIn: (line: string, mins: string, far: string) => string;
    alertAtStop: (line: string) => string;
    alertArriving: (line: string, far: string) => string;
};

export const T: Record<Lang, Dict> = {
    az: {
        welcomeNew: (name) =>
            [
                `Salam, ${name}! Bakı avtobuslarının indi harada olduğunu və dayanacağınıza neçə dəqiqəyə çatacağını göstərirəm.`,
                "",
                "Tətbiqi açın, dayanacağınızı tapın və lazım olan marşrutu yadda saxlayın — o, aşağıda düymə kimi görünəcək. Sonra bir toxunuş kifayətdir.",
                "",
                "Marşrut nömrəsi, dayanacaq adı və ya geolokasiya da göndərə bilərsiniz.",
            ].join("\n"),
        welcomeBack: (name) =>
            `Yenidən xoş gəldiniz, ${name}! Səfərləriniz aşağıdakı düymələrdədir — basın, avtobusun neçə dəqiqəyə gələcəyini göstərim.`,
        help: [
            "<b>Necə istifadə etməli</b>",
            "",
            "• Aşağıdakı səfər düyməsi — avtobusunuzun neçə dəqiqəyə gələcəyini göstərir.",
            "• Marşrut nömrəsi, məsələn <code>26</code> — yadda saxlanmış dayanacaqlarınız üçün eyni məlumat.",
            "• Dayanacağın adı — onu tapacağam.",
            "• Geolokasiya — yaxınlıqdakı dayanacaqları göstərəcəyəm.",
            "• /language — dili dəyişmək.",
            "",
            "Dayanacaqlar, səfərlər və bildirişlər tətbiqdə tənzimlənir — mesaj sahəsinin yanındakı «Open» düyməsi.",
        ].join("\n"),
        openApp: "Tətbiqi aç",
        openAppPrompt: "Tətbiqi açın:",
        keyboardReady: "Səfər düymələri yeniləndi.",
        allTrips: "⭐ Bütün səfərlər",
        refresh: "🔄 Yenilə",
        map: "🗺 Xəritə",
        stopAlerts: "Daha göndərmə",
        serviceDown: "⚠️ Avtobus xidməti hazırda cavab vermir. Bir dəqiqədən sonra yenidən cəhd edin.",
        alreadyFresh: "Məlumat təzədir — indicə yenilədim",
        notModified: "Dəyişiklik yoxdur",
        staleButton: "Bu düymə artıq köhnəlib",
        alertOff: "Bildiriş söndürüldü",
        privateOnly: "Mən yalnız şəxsi mesajlarda işləyirəm.",
        openBot: "Botu aç",
        noTrips: "Hələ yadda saxlanmış səfəriniz yoxdur.",
        pickStop: "Dayanacaq seç",
        whichStop: (line) => `${line} üçün hansı dayanacağı göstərim?`,
        notThroughStops: (line) =>
            `${line} marşrutu yadda saxladığınız dayanacaqlardan keçmir. Dayanacaq seçmək və avtobusları xəritədə görmək üçün marşrutu açın.`,
        routeButton: (line) => `${line} marşrutu`,
        noRoute: (line) => `${line} nömrəli marşrut tapılmadı.`,
        stopNotFound:
            "Belə dayanacaq tapmadım. Adın bir hissəsini yazın — məsələn, «Nərimanov» və ya «28 May» — ya da geolokasiya göndərin.",
        searchInApp: "Tətbiqdə axtar",
        found: (q) => `«${q}» üzrə tapdıqlarım:`,
        nearby: "Yaxınlıqdakı dayanacaqlar:",
        nothingNearby: "600 m radiusunda dayanacaq yoxdur.",
        keyboardUpdated: (list) => `Aşağıdakı düymələr yeniləndi: ${list}.`,
        keyboardRemoved: "Yadda saxlanmış səfər qalmadı — düymələri sildim.",
        alertExpired: (line, stop) => `🔕 Bir saat ərzində ${line} nömrəli avtobus «${stop}» dayanacağına gəlmədi. Bildiriş söndürüldü.`,
        chooseLanguage: "Dili seçin:",
        sameAsTelegram: "Telegram-dakı kimi",
        languageSet: "Hazırdır, artıq azərbaycanca danışıram.",

        bus: "🚌 Avtobus",
        stop: "📍 Dayanacaq:",
        arrivesIn: (mins, far) => `⏳ ${mins} sonra${far}`,
        nowAtStop: "⏳ İndi: <b>dayanacaqdadır</b>",
        nowArriving: (far) => `⏳ İndi: <b>yaxınlaşır</b>${far}`,
        following: (list) => `⏭ Sonra: ${list}`,
        min: "dəq",
        atStop: "dayanacaqda",
        nextPlanned: (time, note) => `🕓 Ən yaxını: <b>saat ${time}</b> (${note})`,
        fromTerminus: "son dayanacaqdan",
        scheduled: "cədvəl üzrə",
        noBuses: "😴 Hazırda xətdə avtobus yoxdur",

        noConnection: "əlaqə yoxdur",
        notRunning: "xətdə yoxdur",
        thenShort: (list) => `sonra ${list} dəq`,
        at: (time) => `saat ${time}`,
        alertIn: (line, mins, far) => `🔔 Avtobus ${line} ${mins} sonra gələcək${far}`,
        alertAtStop: (line) => `🔔 Avtobus ${line} artıq dayanacaqdadır`,
        alertArriving: (line, far) => `🔔 Avtobus ${line} yaxınlaşır${far}`,
    },

    ru: {
        welcomeNew: (name) =>
            [
                `Привет, ${name}! Я показываю, где сейчас автобусы Баку и через сколько они будут на вашей остановке.`,
                "",
                "Откройте приложение, найдите свою остановку и сохраните нужный номер — он появится кнопкой внизу. Дальше хватит одного нажатия.",
                "",
                "Ещё можно прислать номер маршрута, название остановки или геопозицию.",
            ].join("\n"),
        welcomeBack: (name) => `С возвращением, ${name}! Ваши поездки — кнопками внизу: нажмите, и я покажу, через сколько придёт автобус.`,
        help: [
            "<b>Как пользоваться</b>",
            "",
            "• Кнопка поездки внизу — через сколько придёт ваш автобус.",
            "• Номер маршрута, например <code>26</code>, — то же для сохранённых остановок.",
            "• Название остановки — найду её.",
            "• Геопозиция — покажу остановки рядом.",
            "• /language — сменить язык.",
            "",
            "Остановки, поездки и уведомления настраиваются в приложении — кнопка «Open» рядом с полем ввода.",
        ].join("\n"),
        openApp: "Открыть приложение",
        openAppPrompt: "Откройте приложение:",
        keyboardReady: "Кнопки поездок обновлены.",
        allTrips: "⭐ Все поездки",
        refresh: "🔄 Обновить",
        map: "🗺 Карта",
        stopAlerts: "Больше не присылать",
        serviceDown: "⚠️ Сервис автобусов сейчас не отвечает. Попробуйте через минуту.",
        alreadyFresh: "Данные свежие — обновлял только что",
        notModified: "Ничего не изменилось",
        staleButton: "Кнопка устарела",
        alertOff: "Уведомление выключено",
        privateOnly: "Я работаю только в личных сообщениях.",
        openBot: "Открыть бота",
        noTrips: "Сохранённых поездок пока нет.",
        pickStop: "Выбрать остановку",
        whichStop: (line) => `На какой остановке смотреть ${line}?`,
        notThroughStops: (line) =>
            `Маршрут ${line} не проходит через ваши остановки. Откройте его, чтобы выбрать остановку и увидеть автобусы на карте.`,
        routeButton: (line) => `Маршрут ${line}`,
        noRoute: (line) => `Маршрута ${line} нет в справочнике.`,
        stopNotFound: "Не нашёл такую остановку. Попробуйте часть названия — например, «Нариманов» или «28 May» — или пришлите геопозицию.",
        searchInApp: "Искать в приложении",
        found: (q) => `Нашёл по запросу «${q}»:`,
        nearby: "Остановки рядом:",
        nothingNearby: "В радиусе 600 м остановок нет.",
        keyboardUpdated: (list) => `Кнопки внизу обновлены: ${list}.`,
        keyboardRemoved: "Сохранённых поездок больше нет — убрал кнопки.",
        alertExpired: (line, stop) => `🔕 За час автобус ${line} так и не подъехал к остановке «${stop}». Уведомление снято.`,
        chooseLanguage: "Выберите язык:",
        sameAsTelegram: "Как в Telegram",
        languageSet: "Готово, теперь я говорю по-русски.",

        bus: "🚌 Автобус",
        stop: "📍 Остановка:",
        arrivesIn: (mins, far) => `⏳ Через: ${mins}${far}`,
        nowAtStop: "⏳ Сейчас: <b>на остановке</b>",
        nowArriving: (far) => `⏳ Сейчас: <b>подъезжает</b>${far}`,
        following: (list) => `⏭ Затем: ${list}`,
        min: "мин",
        atStop: "на остановке",
        nextPlanned: (time, note) => `🕓 Ближайший: <b>в ${time}</b> (${note})`,
        fromTerminus: "с конечной",
        scheduled: "по расписанию",
        noBuses: "😴 Сейчас на линии нет автобусов",

        noConnection: "нет связи",
        notRunning: "нет на линии",
        thenShort: (list) => `затем ${list} мин`,
        at: (time) => `в ${time}`,
        alertIn: (line, mins, far) => `🔔 Автобус ${line} через ${mins}${far}`,
        alertAtStop: (line) => `🔔 Автобус ${line} уже на остановке`,
        alertArriving: (line, far) => `🔔 Автобус ${line} подъезжает${far}`,
    },

    en: {
        welcomeNew: (name) =>
            [
                `Hi, ${name}! I show where Baku buses are right now and how many minutes until they reach your stop.`,
                "",
                "Open the app, find your stop and save the route you need — it will appear as a button below. After that, one tap is enough.",
                "",
                "You can also send me a route number, a stop name or your location.",
            ].join("\n"),
        welcomeBack: (name) => `Welcome back, ${name}! Your trips are the buttons below — tap one to see when your bus arrives.`,
        help: [
            "<b>How it works</b>",
            "",
            "• A trip button below shows when your bus arrives.",
            "• A route number, e.g. <code>26</code>, does the same for your saved stops.",
            "• A stop name — I'll find it.",
            "• Your location — I'll show the stops nearby.",
            "• /language — change the language.",
            "",
            "Stops, trips and alerts are set up in the app — the “Open” button next to the message field.",
        ].join("\n"),
        openApp: "Open the app",
        openAppPrompt: "Open the app:",
        keyboardReady: "Trip buttons are updated.",
        allTrips: "⭐ All trips",
        refresh: "🔄 Refresh",
        map: "🗺 Map",
        stopAlerts: "Stop these alerts",
        serviceDown: "⚠️ The bus service isn't responding right now. Please try again in a minute.",
        alreadyFresh: "Already up to date",
        notModified: "Nothing has changed",
        staleButton: "This button is outdated",
        alertOff: "Alert turned off",
        privateOnly: "I only work in private messages.",
        openBot: "Open the bot",
        noTrips: "You have no saved trips yet.",
        pickStop: "Pick a stop",
        whichStop: (line) => `Which stop should I show bus ${line} for?`,
        notThroughStops: (line) => `Route ${line} doesn't pass your saved stops. Open it to pick a stop and see the buses on the map.`,
        routeButton: (line) => `Route ${line}`,
        noRoute: (line) => `There's no route ${line}.`,
        stopNotFound: "I couldn't find that stop. Try part of the name — e.g. “Narimanov” or “28 May” — or send your location.",
        searchInApp: "Search in the app",
        found: (q) => `Here's what I found for “${q}”:`,
        nearby: "Stops nearby:",
        nothingNearby: "No stops within 600 m.",
        keyboardUpdated: (list) => `Buttons below updated: ${list}.`,
        keyboardRemoved: "No saved trips left — buttons removed.",
        alertExpired: (line, stop) => `🔕 Bus ${line} didn't reach “${stop}” within an hour. The alert has been removed.`,
        chooseLanguage: "Choose a language:",
        sameAsTelegram: "Same as Telegram",
        languageSet: "Done — I'll speak English now.",

        bus: "🚌 Bus",
        stop: "📍 Stop:",
        arrivesIn: (mins, far) => `⏳ Arrives in ${mins}${far}`,
        nowAtStop: "⏳ Now: <b>at the stop</b>",
        nowArriving: (far) => `⏳ Now: <b>arriving</b>${far}`,
        following: (list) => `⏭ Then: ${list}`,
        min: "min",
        atStop: "at the stop",
        nextPlanned: (time, note) => `🕓 Next: <b>${time}</b> (${note})`,
        fromTerminus: "from the terminus",
        scheduled: "scheduled",
        noBuses: "😴 No buses on the route right now",

        noConnection: "no connection",
        notRunning: "not running",
        thenShort: (list) => `then ${list} min`,
        at: (time) => `at ${time}`,
        alertIn: (line, mins, far) => `🔔 Bus ${line} in ${mins}${far}`,
        alertAtStop: (line) => `🔔 Bus ${line} is at the stop`,
        alertArriving: (line, far) => `🔔 Bus ${line} is arriving${far}`,
    },
};

export const ALL_TRIPS_LABELS = new Set(Object.values(T).map((d) => d.allTrips));
