/* voice.js — a small voice beside the fingertip, with a sense of humour and a salesman's patience.
   It reacts to whatever people write or draw on the glass. Drawings are read by Google's AutoDraw recogniser
   with a confidence score: when it is sure, the voice guesses the business behind it; when it hesitates, it asks.
   Anything else goes to an open model that runs inside the visitor's own browser (Gemma 3 1B through WebGPU,
   see brain-worker.js): no server, no key, no cost. The repertoire answers instantly for the few things that
   must be exact (prices, pages) and stands in wherever the model is not available. */
(() => {
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const clean = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const count = (c) => (c ? c.split(" ").length : 0);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [b[i], b[j]] = [b[j], b[i]]; } return b; };

  // what AutoDraw's labels are called in each language, with their article
  const NOUNS = Object.fromEntries(`house|a house|una casa|una casa
building|a building|un edifici|un edificio
barn|a barn|un graner|un granero
castle|a castle|un castell|un castillo
church|a church|una església|una iglesia
key|a key|una clau|una llave
door|a door|una porta|una puerta
skyscraper|a skyscraper|un gratacel|un rascacielos
school|a school|una escola|una escuela
book|a book|un llibre|un libro
pencil|a pencil|un llapis|un lápiz
backpack|a backpack|una motxilla|una mochila
hospital|a hospital|un hospital|un hospital
pill|a pill|una pastilla|una pastilla
syringe|a syringe|una xeringa|una jeringuilla
bandage|a plaster|una tireta|una tirita
ambulance|an ambulance|una ambulància|una ambulancia
stethoscope|a stethoscope|un fonendoscopi|un fonendoscopio
tooth|a tooth|una dent|un diente
toothbrush|a toothbrush|un raspall de dents|un cepillo de dientes
cake|a cake|un pastís|una tarta
birthday cake|a birthday cake|un pastís d’aniversari|una tarta de cumpleaños
bread|a loaf of bread|un pa|un pan
cupcake|a cupcake|un cupcake|un cupcake
cookie|a cookie|una galeta|una galleta
donut|a doughnut|un dònut|un dónut
croissant|a croissant|un croissant|un cruasán
coffee cup|a cup of coffee|una tassa de cafè|una taza de café
cup|a cup|una tassa|una taza
mug|a mug|una tassa|una taza
teapot|a teapot|una tetera|una tetera
wine glass|a glass of wine|una copa de vi|una copa de vino
wine bottle|a bottle of wine|una ampolla de vi|una botella de vino
beer|a beer|una cervesa|una cerveza
beer mug|a pint|una gerra de cervesa|una jarra de cerveza
cocktail|a cocktail|un còctel|un cóctel
bottle|a bottle|una ampolla|una botella
pizza|a pizza|una pizza|una pizza
hamburger|a burger|una hamburguesa|una hamburguesa
hot dog|a hot dog|un frankfurt|un perrito caliente
sandwich|a sandwich|un entrepà|un bocadillo
fork|a fork|una forquilla|un tenedor
knife|a knife|un ganivet|un cuchillo
spoon|a spoon|una cullera|una cuchara
frying pan|a frying pan|una paella|una sartén
ice cream|an ice cream|un gelat|un helado
steak|a steak|un bistec|un filete
sushi|some sushi|sushi|sushi
taco|a taco|un taco|un taco
carrot|a carrot|una pastanaga|una zanahoria
apple|an apple|una poma|una manzana
banana|a banana|un plàtan|un plátano
pear|a pear|una pera|una pera
grapes|some grapes|raïm|uvas
strawberry|a strawberry|una maduixa|una fresa
watermelon|a watermelon|una síndria|una sandía
lollipop|a lollipop|una piruleta|una piruleta
scissors|a pair of scissors|unes tisores|unas tijeras
comb|a comb|una pinta|un peine
hair dryer|a hairdryer|un assecador|un secador
lipstick|a lipstick|un pintallavis|un pintalabios
car|a car|un cotxe|un coche
truck|a lorry|un camió|un camión
bus|a bus|un autobús|un autobús
motorbike|a motorbike|una moto|una moto
tractor|a tractor|un tractor|un tractor
van|a van|una furgoneta|una furgoneta
police car|a police car|un cotxe de policia|un coche de policía
firetruck|a fire engine|un camió de bombers|un camión de bomberos
bicycle|a bike|una bicicleta|una bicicleta
flower|a flower|una flor|una flor
tree|a tree|un arbre|un árbol
leaf|a leaf|una fulla|una hoja
cactus|a cactus|un cactus|un cactus
rose|a rose|una rosa|una rosa
sunflower|a sunflower|un gira-sol|un girasol
house plant|a plant|una planta|una planta
mushroom|a mushroom|un bolet|una seta
dog|a dog|un gos|un perro
cat|a cat|un gat|un gato
fish|a fish|un peix|un pez
bird|a bird|un ocell|un pájaro
horse|a horse|un cavall|un caballo
rabbit|a rabbit|un conill|un conejo
cow|a cow|una vaca|una vaca
pig|a pig|un porc|un cerdo
duck|a duck|un ànec|un pato
owl|an owl|un mussol|un búho
dog house|a kennel|una caseta de gos|una caseta de perro
camera|a camera|una càmera|una cámara
dumbbell|a dumbbell|una pesa|una pesa
basketball|a basketball|una pilota de bàsquet|un balón de baloncesto
soccer ball|a football|una pilota de futbol|un balón de fútbol
tennis racquet|a tennis racket|una raqueta|una raqueta
baseball bat|a baseball bat|un bat de beisbol|un bate de béisbol
skateboard|a skateboard|un monopatí|un monopatín
trophy|a trophy|un trofeu|un trofeo
laptop|a laptop|un portàtil|un portátil
computer|a computer|un ordinador|un ordenador
cell phone|a phone|un mòbil|un móvil
keyboard|a keyboard|un teclat|un teclado
television|a television|una tele|una tele
robot|a robot|un robot|un robot
rocket|a rocket|un coet|un cohete
guitar|a guitar|una guitarra|una guitarra
piano|a piano|un piano|un piano
microphone|a microphone|un micròfon|un micrófono
headphones|some headphones|uns auriculars|unos auriculares
drums|a drum kit|una bateria|una batería
violin|a violin|un violí|un violín
trumpet|a trumpet|una trompeta|una trompeta
saxophone|a saxophone|un saxo|un saxo
shoe|a shoe|una sabata|un zapato
t-shirt|a T-shirt|una samarreta|una camiseta
dress|a dress|un vestit|un vestido
hat|a hat|un barret|un sombrero
pants|a pair of trousers|uns pantalons|unos pantalones
sock|a sock|un mitjó|un calcetín
eyeglasses|a pair of glasses|unes ulleres|unas gafas
purse|a handbag|una bossa|un bolso
crown|a crown|una corona|una corona
jacket|a jacket|una jaqueta|una chaqueta
tie|a tie|una corbata|una corbata
ring|a ring|un anell|un anillo
diamond|a diamond|un diamant|un diamante
necklace|a necklace|un collaret|un collar
wristwatch|a watch|un rellotge|un reloj
hammer|a hammer|un martell|un martillo
screwdriver|a screwdriver|un tornavís|un destornillador
saw|a saw|una serra|una sierra
drill|a drill|un trepant|un taladro
axe|an axe|una destral|un hacha
ladder|a ladder|una escala|una escalera
paint can|a tin of paint|un pot de pintura|un bote de pintura
light bulb|a light bulb|una bombeta|una bombilla
nail|a nail|un clau|un clavo
shovel|a shovel|una pala|una pala
rake|a rake|un rasclet|un rastrillo
paintbrush|a paintbrush|un pinzell|un pincel
crayon|a crayon|una cera|una cera
marker|a marker|un retolador|un rotulador
airplane|a plane|un avió|un avión
suitcase|a suitcase|una maleta|una maleta
sailboat|a sailing boat|un veler|un velero
cruise ship|a ship|un vaixell|un barco
mountain|a mountain|una muntanya|una montaña
beach|a beach|una platja|una playa
tent|a tent|una tenda|una tienda de campaña
palm tree|a palm tree|una palmera|una palmera
train|a train|un tren|un tren
calculator|a calculator|una calculadora|una calculadora
heart|a heart|un cor|un corazón
smiley face|a smiley|una cara somrient|una cara sonriente
face|a face|una cara|una cara
star|a star|una estrella|una estrella
sun|the sun|el sol|el sol
cloud|a cloud|un núvol|una nube
umbrella|an umbrella|un paraigua|un paraguas
rain|rain|pluja|lluvia
rainbow|a rainbow|un arc de Sant Martí|un arcoíris
moon|the moon|la lluna|la luna
snowflake|a snowflake|un floc de neu|un copo de nieve
lightning|a lightning bolt|un llamp|un rayo
snowman|a snowman|un ninot de neu|un muñeco de nieve
glove|a glove|un guant|un guante
box|a box|una caixa|una caja
chair|a chair|una cadira|una silla
table|a table|una taula|una mesa
bench|a bench|un banc|un banco
candle|a candle|una espelma|una vela
envelope|an envelope|un sobre|un sobre
alarm clock|an alarm clock|un despertador|un despertador
eye|an eye|un ull|un ojo
hand|a hand|una mà|una mano
circle|a circle|un cercle|un círculo
square|a square|un quadrat|un cuadrado
triangle|a triangle|un triangle|un triángulo
line|a line|una línia|una línea
squiggle|a squiggle|un gargot|un garabato
zigzag|a zigzag|un ziga-zaga|un zigzag
hexagon|a hexagon|un hexàgon|un hexágono
octagon|an octagon|un octàgon|un octógono`.split("\n").map((r) => { const [k, en, ca, es] = r.split("|"); return [k, { en, ca, es }]; }));

  // the kind of business a drawing suggests (only the recogniser's first, confident answer counts)
  const DRAW = {
    home: ["house", "building", "barn", "castle", "key", "door", "skyscraper"],
    school: ["school", "book", "pencil", "backpack"],
    health: ["hospital", "pill", "syringe", "bandage", "ambulance", "stethoscope"],
    dental: ["tooth", "toothbrush"],
    bakery: ["cake", "birthday cake", "bread", "cupcake", "cookie", "donut", "croissant"],
    cafe: ["coffee cup", "cup", "mug", "teapot"],
    bar: ["wine glass", "wine bottle", "beer", "beer mug", "cocktail", "bottle"],
    food: ["pizza", "hamburger", "hot dog", "sandwich", "fork", "knife", "spoon", "frying pan", "ice cream", "steak", "sushi", "taco", "carrot", "apple", "banana", "pear", "grapes", "strawberry", "watermelon", "lollipop"],
    hair: ["scissors", "comb", "hair dryer", "lipstick"],
    motor: ["car", "truck", "bus", "motorbike", "tractor", "van", "police car", "firetruck"],
    bike: ["bicycle"],
    garden: ["flower", "tree", "leaf", "cactus", "rose", "sunflower", "house plant", "mushroom"],
    pets: ["dog", "cat", "fish", "bird", "horse", "rabbit", "dog house"],
    photo: ["camera"],
    sport: ["dumbbell", "basketball", "soccer ball", "tennis racquet", "baseball bat", "skateboard", "trophy"],
    tech: ["laptop", "computer", "cell phone", "keyboard", "television", "robot", "rocket"],
    music: ["guitar", "piano", "microphone", "headphones", "drums", "violin", "trumpet", "saxophone"],
    fashion: ["shoe", "t-shirt", "dress", "hat", "pants", "sock", "eyeglasses", "purse", "crown", "jacket", "tie"],
    jewel: ["ring", "diamond", "necklace", "wristwatch"],
    trades: ["hammer", "screwdriver", "saw", "drill", "axe", "ladder", "paint can", "light bulb", "nail", "shovel", "rake"],
    art: ["paintbrush", "crayon", "marker"],
    travel: ["airplane", "suitcase", "sailboat", "cruise ship", "mountain", "beach", "tent", "palm tree", "train"],
    money: ["calculator"],
    love: ["heart", "smiley face", "face", "star"],
    weather: ["sun", "cloud", "umbrella", "rain", "rainbow", "moon", "snowflake", "lightning", "snowman"],
    shape: ["circle", "square", "triangle", "line", "squiggle", "zigzag", "hexagon", "octagon"],
  };
  const KIND = {};
  for (const [k, list] of Object.entries(DRAW)) for (const l of list) KIND[l] = k;
  // what the business probably is, for the model's memory of the visitor
  const BIZ = {
    home: ["architecture, building or property", "arquitectura, construcció o immobiliària", "arquitectura, construcción o inmobiliaria"],
    school: ["teaching", "ensenyament", "enseñanza"], health: ["health", "salut", "salud"], dental: ["a dental clinic", "una clínica dental", "una clínica dental"],
    bakery: ["a bakery", "un forn o una pastisseria", "un horno o una pastelería"], cafe: ["a café", "una cafeteria", "una cafetería"], bar: ["a bar", "un bar", "un bar"],
    food: ["a restaurant", "un restaurant", "un restaurante"], hair: ["a salon", "una perruqueria o un centre d’estètica", "una peluquería o un centro de estética"],
    motor: ["cars", "el món del motor", "el mundo del motor"], bike: ["bikes", "les bicicletes", "las bicicletas"], garden: ["flowers or gardens", "flors o jardins", "flores o jardines"],
    pets: ["pets", "les mascotes", "las mascotas"], photo: ["photography", "la fotografia", "la fotografía"], sport: ["sport", "l’esport", "el deporte"],
    tech: ["technology", "la tecnologia", "la tecnología"], music: ["music", "la música", "la música"], fashion: ["fashion", "la moda", "la moda"],
    jewel: ["jewellery", "la joieria", "la joyería"], trades: ["a trade", "un ofici", "un oficio"], art: ["art", "l’art", "el arte"],
    travel: ["travel or hospitality", "els viatges o l’hostaleria", "los viajes o la hostelería"], money: ["finance", "les finances", "las finanzas"],
  };

  // a yes or a no only counts as one when it is short and comes first
  const YES = ["yes", "yeah", "yep", "yup", "sure", "ok", "okay", "si", "vale", "dacord", "d acord", "de acuerdo", "clar", "claro", "venga", "endavant", "adelante", "please", "siusplau", "porfavor", "perfecte", "perfecto", "genial", "of course", "go on", "va"];
  const NO = ["no", "nope", "nah", "not now", "ara no", "ahora no", "never", "mai", "nunca", "no gracies", "no gracias", "no thanks", "millor no", "mejor no"];
  const starts = (c, list) => list.some((x) => c === x || c.startsWith(x + " "));
  // the few things answered from the repertoire; each phrase must be the whole message or its start
  const THEMES = [
    { k: "price", any: true, w: ["price", "prices", "preu", "preus", "precio", "precios", "quant costa", "quant val", "cuanto cuesta", "cuanto vale", "how much", "pressupost", "presupuesto", "tarifa", "tarifas", "tarifes"] },
    { k: "hi", w: ["hello", "hola", "hey", "hi", "bon dia", "bondia", "buenas", "holi", "bona tarda", "buenos dias", "buenas tardes", "ei"] },
    { k: "rude", w: ["fuck", "shit", "merda", "mierda", "puta", "joder", "cabron", "idiot", "stupid", "tonto", "tonta", "imbecil", "caca", "pedo", "gilipollas", "capullo"] },
  ];
  // the rest of the repertoire, for when the model is not there (phones, older computers)
  const SPARE = [
    { k: "how", w: ["how are you", "com estas", "com va", "que tal", "como estas", "como va", "whats up"] },
    { k: "web", w: ["web", "website", "webs", "pagina web", "landing", "shop", "botiga", "tienda", "ecommerce", "logo", "marca", "brand"] },
    { k: "bye", w: ["bye", "adeu", "adios", "chao", "ciao", "goodbye", "fins aviat", "hasta luego"] },
    { k: "thanks", w: ["thanks", "thank you", "gracies", "moltes gracies", "gracias", "merci", "thx"] },
    { k: "love", w: ["love", "amor", "t estimo", "te quiero", "kiss", "peto", "beso", "guapo", "guapa"] },
    { k: "coffee", w: ["coffee", "cafe", "beer", "cervesa", "cerveza", "wine", "vino"] },
    { k: "pol", w: ["pol", "planas", "pol planas"] },
    { k: "help", w: ["help", "ajuda", "ayuda", "info"] },
    { k: "ai", w: ["ai", "ia", "robot", "bot", "chatgpt", "gpt", "ets una ia", "eres una ia", "are you ai"] },
    { k: "football", w: ["barca", "madrid", "messi", "futbol", "football", "soccer"] },
  ];
  const theme = (list, c) => list.find((th) => (th.any || count(c) <= 3) && th.w.some((x) => c === x || c.startsWith(x + " ") || (th.any && c.includes(x))))?.k;

  const LINES = {
    en: {
      hello: "Hi! What's your name? Write it on the glass with your finger.",
      helloAgain: ["Hello! What's your name? Write it on the glass.", "Hi there! Tell me your name: just write it on the glass."],
      remind_name: ["By the way, I still don't know your name!", "And your name is…? Write it on the glass."],
      remind_business: ["So, what's your business? Draw it or write it!", "Tell me what you do: a drawing is fine too."],
      remind_web: ["By the way, do you have a website now?", "And do you already have a website?"],
      nudge_name: "Try writing your name on the glass, like “Anna”.",
      nudge_business: "Draw your business on the glass, or write it: “bakery”, “garage”, “clinic”…",
      nudge_free: "Write anything: “prices”, your business, a question…",
      askWeb: ["Do you have a website now?", "Do you already have a website?"],
      hasWeb: ["Good start. Pol can make it bring you more clients.", "Then let's make it work harder for you."],
      noWeb: ["Then we start from scratch, which is the best way.", "Even better: a clean start, done right."],
      afterNo: ["No problem. If you're curious, write “prices” and I'll tell you.", "Fair enough. Write “prices” whenever you like."],
      bizLine: ["I like it. A good website brings that kind of business clients while you sleep.", "Lovely. People look for that on their phones every day."],
      met2: (n) => pick([`Nice to meet you, ${n}! What does your business do? Draw it on the glass, or write it.`, `${n}, lovely name! And what do you do? You can draw it if you like.`]),
      idle_morning: ["Morning rain is the best rain. Coffee in hand, I hope?", "The birds are up. Are you a morning person?", "Early start. Rain sounds better before the emails, don't you think?"],
      idle_midday: ["Midday and still raining. Perfect lunch weather, if you ask me.", "Lunchtime. What do you eat when it rains?", "Grey noon, bright ideas. That's the deal here."],
      idle_afternoon: ["Slow afternoon. The drops are racing down the glass; I'm betting on the left one.", "Afternoon rain makes everything softer. Even deadlines.", "Still here? I like that. Tell me something."],
      idle_sunset: ["Look, the light is turning gold behind the rain.", "Sunset through wet glass. I never get tired of it.", "The blackbird is singing. It does that every evening, you know?"],
      idle_evening: ["Evening already. The rain gets cosier as it gets dark.", "Time for a blanket and a good website. Or just the blanket.", "The street lights must be on by now. Do you like the evening?"],
      idle_night: ["Night. Just us and the rain now.", "It's late. The rain doesn't sleep, and apparently neither do you.", "At night every drop sounds closer. Listen."],
      idle_storm: ["That was a big one. All right over there?", "Storm outside, calm in here. Best of both worlds.", "I love a storm. From behind the glass, obviously."],
      idle_any: ["Still there? Write me anything: a word, a doodle, your name.", "I could watch the rain all day. Actually, I do.", "What brings you here today?"],
      askName: ["What's your name?", "And what's your name?"],
      met: (n) => pick([`Nice to meet you, ${n}! What brings you here today?`, `${n}, lovely name. So, what do you do?`, `Hello, ${n}! Welcome to the window. What brings you by?`]),
      askBiz: ["What does your business do? You can draw it if you like!", "So, what’s your business? Draw it, if words are too dry."],
      open: [(n) => `${cap(n)}!`, (n) => `${cap(n)}, right?`],
      pitch: {
        home: ["Architect, builder or estate agent? Either way, it deserves a website that sells it.", "If you build homes, your website should be the cosiest one on the street."],
        school: ["Teaching something? I can make enrolling the easiest lesson.", "An academy? Parents choose online. Let’s make them choose you."],
        health: ["A clinic? Patients book at 11 p.m. on their phones. Let’s make that easy.", "A patient’s trust starts before they walk through the door."],
        dental: ["A dentist? I promise my websites don’t hurt.", "A dental clinic? Booking should be easier than a check-up."],
        bakery: ["A bakery? Your website should smell as good as your shop.", "A good website makes people hungry from the sofa."],
        cafe: ["A café? I design the website, you bring the coffee.", "A good website is like a good espresso: short, strong, and people come back."],
        bar: ["A bar? Let’s get people through the door before the first round.", "A good website fills the terrace before the sun comes out."],
        food: ["A restaurant? A website that fills tables on any Tuesday.", "Now I’m hungry. If you cook like that, your menu deserves a better website."],
        hair: ["A salon? People book when they see your work. Let’s show it.", "Booking in two taps beats a thousand flyers."],
        motor: ["A garage or a dealership? Let’s get your phone ringing.", "A website as fast as your cars. Or faster."],
        bike: ["A bike shop or repairs? I’ll make sure people find you before the hill.", "A website as light as a carbon frame."],
        garden: ["Florist or gardener? Your website should bloom too.", "A well-kept website grows on its own, like a good garden. Almost."],
        pets: ["Vet, groomer or pet shop? People choose with their heart. Let’s win it.", "Their owners search online. Let’s make them find you."],
        photo: ["A photographer? You need a website as sharp as your photos.", "Your work deserves a gallery, not a folder."],
        sport: ["A club, a gym or a sports shop? Let’s turn visitors into members.", "A website in shape. No excuses, no Mondays."],
        tech: ["Then you know a good website is half the product.", "A tech project? The website has to explain it in five seconds."],
        music: ["A band, a school or a studio? Let’s make your website sound good.", "A well-tuned website sells tickets too."],
        fashion: ["A shop or a fashion brand? Your website should fit like it was tailored.", "Your website should be the shop window that turns heads."],
        jewel: ["A jeweller? Let’s make the website sparkle too.", "Small details look better on a big, calm website."],
        trades: ["Builder, plumber, carpenter? More calls, fewer flyers.", "A good website works for you while you work."],
        art: ["An artist? Your website should be a gallery, not a list.", "Let the work speak; I’ll make the frame."],
        travel: ["A hotel, an agency or a guide? Let’s get people booking before they leave home.", "The trip starts when someone opens your website."],
        money: ["An adviser or an accountant? Trust starts on the first page.", "A clear website makes people write to you without fear."],
        love: ["I’ll take that as a compliment. And what do you do?", "Sweet. Now draw your business and I’ll try to guess it."],
        weather: ["The weather here doesn’t change much, as you can see. What do you do?", "Spot-on forecast. Now draw your business and I’ll try to guess it."],
        shape: ["Perfect geometry. Now draw your business and I’ll try to guess it.", "Very clean. But what do you do? Draw it, go on."],
        other: ["Is that your business? Tell me, I’m curious.", "Nice drawing. Has it got something to do with your work?"],
      },
      guess: [(a, b) => `Is that ${a} or ${b}? The fog isn’t helping.`, (a, b) => `I’d say ${a}… or maybe ${b}. Am I right?`],
      unclear: ["I can’t guess it. What is it? You can write it.", "Interesting. Abstract art? Tell me what it is.", "You got me. What did you draw?"],
      offerServices: ["Want me to show you what’s included?", "Shall I tell you what’s included?"],
      offerMail: ["Shall I open an email so you can tell me more?", "Want to talk about it? I’ll open an email for you.", "Shall we talk? One email and it’s done."],
      mailOpen: "Opening your email. I reply within one working day.",
      declined: ["No problem. Write me anything else.", "Fair enough. I’ll be right here.", "Okay. No pressure, ever."],
      soonOffer: ["That page opens very soon. Shall I open an email so you can write to me meanwhile?", "Still being finished. Want to write to me in the meantime?"],
      waking: (p) => (p > 2 ? `Hold on, my brain is waking up… ${p}%` : "Hold on, I’m waking up my brain…"),
      awake: "I’m awake. Write me anything.",
      nobrain: "My AI brain needs a computer with a recent Chrome or Edge. Here, I answer from memory.",
      broken: "My AI brain tripped over a raindrop. I’ll answer from memory for now.",
      work: "Going to show you my work…", about: "Let me tell you who I am…", services: "Here’s what I can do for you…", contact: "Let’s talk. Taking you there…",
      hi: ["Hello! Nice to see someone at the window.", "Hi there. You write nicely on wet glass.", "Hello! Come in, the glass is warm."],
      sun: "Let the sun out for a moment.", rain: "More rain, then. Bring an umbrella.", home: "You’re already home. Cosy, isn’t it?",
      price: ["Landing pages from €1,200, full websites from €2,900. Fixed price, no surprises.", "From €1,200 for a landing page and €2,900 for a full website. The first call is free."],
      rude: ["Rude. The rain heard that.", "I’ll pretend the fog hid that.", "I’m made of water and pixels and I still have better manners."],
      how: ["Better now that someone’s writing to me. How’s business?", "Can’t complain, I live in a window. And you?"],
      web: ["A website? That’s literally my job.", "Say no more. The first call is free."],
      bye: ["Leaving already? Come back when it rains. So, always.", "Bye! Close the window on your way out."],
      thanks: ["You’re welcome. I’m here all day.", "Anytime. It’s not like I can go outside."],
      love: ["Careful, I fog up easily.", "Stop it, I’m blushing. In green."],
      coffee: ["Black, no sugar. Like this website.", "Make it two. Then we talk about your website."],
      pol: ["That’s me. Hi!", "Present. Behind the glass, as always."],
      help: ["Write or draw on the glass with your finger. I read it and answer.", "Press, drag, write. I read it. That’s the whole trick."],
      ai: ["Am I an AI? I’m a website with feelings.", "A little AI, living inside your browser. Pol is the human one."],
      football: ["I only follow the drops racing down the glass.", "Goal! Now let’s talk about your website."],
      unknown: (w) => pick([`“${w}”. I like it. And what do you do?`, `I read “${w}”. Noted. Now tell me about your business.`, `“${w}”? I’ll pretend I understood perfectly.`, `“${w}”. Framed and hung on the wall.`]),
      unsure: ["Good question. That one’s better over a free call with Pol.", "I’d rather not guess. Pol answers that properly, and the first call is free."],
      blank: ["Your handwriting is… artistic. Try a bit bigger?", "I couldn’t read that. Even doctors write better.", "Was that a word or a drawing? Both are welcome."],
    },
    ca: {
      hello: "Hola! Com et dius? Escriu-ho al vidre amb el dit.",
      helloAgain: ["Hola! Com et dius? Escriu el teu nom al vidre.", "Ei, hola! Digue’m el teu nom: escriu-lo al vidre."],
      remind_name: ["Per cert, encara no sé com et dius!", "I tu et dius…? Escriu-ho al vidre."],
      remind_business: ["I a què et dediques? Dibuixa-ho o escriu-ho!", "Explica’m què fas: un dibuix també val."],
      remind_web: ["Per cert, ja teniu web, ara?", "I ja teniu web?"],
      nudge_name: "Prova d’escriure el teu nom al vidre, per exemple «Anna».",
      nudge_business: "Dibuixa el teu negoci al vidre, o escriu-lo: «fleca», «taller», «clínica»…",
      nudge_free: "Escriu el que vulguis: «preus», el teu negoci, una pregunta…",
      askWeb: ["Ja teniu web, ara?", "I ara mateix, ja teniu web?"],
      hasWeb: ["Bon començament. En Pol pot fer que et porti més clients.", "Doncs fem que treballi més per tu."],
      noWeb: ["Doncs comencem de zero, que és la millor manera.", "Millor: un començament net i ben fet."],
      afterNo: ["Cap problema. Si tens curiositat, escriu «preus» i t’ho explico.", "Entesos. Escriu «preus» quan vulguis."],
      bizLine: ["M’agrada. Una bona web porta clients a aquest tipus de negoci mentre dorms.", "Que bé. La gent ho busca pel mòbil cada dia."],
      met2: (n) => pick([`Encantat, ${n}! A què es dedica el teu negoci? Dibuixa-ho al vidre, o escriu-ho.`, `${n}, quin nom més bonic! I a què et dediques? Si vols, dibuixa-ho.`]),
      idle_morning: ["La pluja del matí és la millor. Amb un cafè a la mà, espero?", "Els ocells ja s’han despertat. Ets de matinar?", "Matí de pluja. Sona millor abans dels correus, oi?"],
      idle_midday: ["Migdia i encara plou. Temps perfecte per dinar tranquil.", "Hora de dinar. Què menges quan plou?", "Migdia gris, idees clares. Aquí funciona així."],
      idle_afternoon: ["Tarda tranquil·la. Les gotes fan curses pel vidre; jo aposto per la de l’esquerra.", "La pluja de la tarda ho fa tot més suau. Fins i tot les entregues.", "Encara aquí? M’agrada. Explica’m alguna cosa."],
      idle_sunset: ["Mira, la llum es torna daurada darrere la pluja.", "Posta de sol a través del vidre mullat. No me’n canso mai.", "La merla canta. Ho fa cada vespre, saps?"],
      idle_evening: ["Ja és vespre. La pluja és més acollidora quan es fa fosc.", "Hora de manta i d’una bona web. O només de manta.", "Ja deuen haver encès els fanals. T’agrada el vespre?"],
      idle_night: ["Nit. Ara només som tu, jo i la pluja.", "És tard. La pluja no dorm, i pel que veig tu tampoc.", "De nit cada gota sona més a prop. Escolta."],
      idle_storm: ["Aquest ha estat fort. Tot bé per aquí?", "Tempesta a fora, calma a dins. El millor dels dos mons.", "M’encanten les tempestes. Des de darrere el vidre, és clar."],
      idle_any: ["Encara hi ets? Escriu-me el que vulguis: una paraula, un dibuix, el teu nom.", "Podria mirar ploure tot el dia. De fet, ho faig.", "Què et porta per aquí, avui?"],
      askName: ["Com et dius?", "I tu, com et dius?"],
      met: (n) => pick([`Encantat, ${n}! Què et porta per aquí?`, `${n}, quin nom més bonic. I a què et dediques?`, `Hola, ${n}! Benvingut a la finestra. Què et porta per aquí?`]),
      askBiz: ["A què es dedica el teu negoci? Si vols, dibuixa-ho!", "I tu, a què et dediques? Si t’és més fàcil, dibuixa-ho."],
      open: [(n) => `${cap(n)}!`, (n) => `${cap(n)}, oi?`],
      pitch: {
        home: ["Arquitecte, constructor o immobiliària? Sigui com sigui, es mereix una web que la vengui.", "Si fas cases, la teva web hauria de ser la més acollidora del carrer."],
        school: ["Ensenyes alguna cosa? Puc fer que inscriure’s sigui la lliçó més fàcil.", "Una acadèmia? Els pares trien per internet. Fem que et triïn a tu."],
        health: ["Una clínica? Els pacients reserven a les onze de la nit, des del mòbil. Fem-ho fàcil.", "La confiança d’un pacient comença abans d’entrar per la porta."],
        dental: ["Dentista? Et prometo que les meves webs no fan mal.", "Una clínica dental? Demanar hora hauria de ser més fàcil que una neteja."],
        bakery: ["Un forn o una pastisseria? La teva web hauria de fer tan bona olor com la botiga.", "Una bona web fa venir gana des del sofà."],
        cafe: ["Una cafeteria? Jo dissenyo la web i tu portes el tallat.", "Una bona web és com un bon cafè: curta, intensa i fa tornar."],
        bar: ["Un bar? Fem que la gent entri abans de la primera ronda.", "Una bona web omple la terrassa abans que surti el sol."],
        food: ["Un restaurant? Una web que ompli taules un dimarts qualsevol.", "Ara tinc gana. Si cuines així, la teva carta es mereix una web a l’altura."],
        hair: ["Una perruqueria? La gent reserva quan veu la teva feina. Ensenyem-la.", "Reservar en dos tocs val més que mil fullets."],
        motor: ["Un taller o un concessionari? Fem que soni el telèfon.", "Una web tan ràpida com els teus cotxes. O més."],
        bike: ["Botiga o taller de bicis? Faré que et trobin abans de la pujada.", "Una web lleugera com un quadre de carboni."],
        garden: ["Floristeria o jardineria? La teva web també ha de florir.", "Una web ben cuidada creix sola, com un bon jardí. Gairebé."],
        pets: ["Veterinari, perruqueria canina o botiga? La gent tria amb el cor. Guanyem-lo.", "Els seus amos busquen per internet. Fem que et trobin a tu."],
        photo: ["Fotògraf? Necessites una web tan nítida com les teves fotos.", "La teva feina es mereix una galeria, no una carpeta."],
        sport: ["Un club, un gimnàs o una botiga d’esports? Convertim visites en socis.", "Una web en forma. Sense excuses ni dilluns."],
        tech: ["Doncs ja saps que una bona web és mig producte.", "Un projecte tecnològic? La web l’ha d’explicar en cinc segons."],
        music: ["Un grup, una escola o un estudi? Fem que la web soni bé.", "Una web ben afinada també ven entrades."],
        fashion: ["Una botiga o una marca de roba? La web t’ha d’anar com una peça a mida.", "La teva web ha de ser l’aparador que fa girar el cap."],
        jewel: ["Una joieria? Fem que la web també brilli.", "Els detalls petits es veuen millor en una web gran i tranquil·la."],
        trades: ["Paleta, lampista, fuster? Més trucades i menys fullets.", "Una bona web treballa per tu mentre tu treballes."],
        art: ["Artista? La teva web ha de ser una galeria, no una llista.", "Deixa que la feina parli; jo hi poso el marc."],
        travel: ["Un hotel, una agència o un guia? Fem que reservin abans de sortir de casa.", "El viatge comença quan algú obre la teva web."],
        money: ["Assessor o gestor? La confiança comença a la primera pàgina.", "Una web clara fa que t’escriguin sense por."],
        love: ["M’ho prenc com un compliment. I a què et dediques?", "Que bonic. Ara dibuixa el teu negoci, a veure si l’endevino."],
        weather: ["El temps d’aquí no canvia gaire, ja ho veus. I tu, a què et dediques?", "Previsió encertada. Ara dibuixa el teu negoci, a veure si l’endevino."],
        shape: ["Geometria perfecta. Ara dibuixa el teu negoci, a veure si l’endevino.", "Molt net. Però a què et dediques? Dibuixa-ho, va."],
        other: ["És el teu negoci? Explica-m’ho, que tinc curiositat.", "Dibuixes bé. Té alguna cosa a veure amb la teva feina?"],
      },
      guess: [(a, b) => `És ${a} o ${b}? El vidre entelat no m’ajuda.`, (a, b) => `Diria que és ${a}… o potser ${b}. Encerto?`],
      unclear: ["No l’endevino. Què és? Ho pots escriure.", "Interessant. Art abstracte? Escriu-me què és.", "M’has guanyat. Què has dibuixat?"],
      offerServices: ["Vols que t’ensenyi què inclou?", "T’explico què hi entra?"],
      offerMail: ["Vols que t’obri un correu i m’ho expliques?", "En parlem? T’obro un correu en un segon.", "T’obro un correu i ho mirem junts?"],
      mailOpen: "T’obro el correu. Responc en un dia laborable.",
      declined: ["Cap problema. Escriu-me el que vulguis.", "D’acord. Seré aquí mateix.", "Entesos. Sense pressa."],
      soonOffer: ["Aquesta pàgina obre molt aviat. Vols que t’obri un correu per escriure’m mentrestant?", "Encara l’estic acabant. Mentrestant, m’escrius un correu?"],
      waking: (p) => (p > 2 ? `Un moment, que desperto el cervell… ${p}%` : "Un moment, que desperto el cervell…"),
      awake: "Ja estic despert. Escriu-me el que vulguis.",
      nobrain: "El meu cervell d’IA necessita un ordinador amb Chrome o Edge recent. Aquí responc de memòria.",
      broken: "El meu cervell d’IA ha relliscat amb una gota. De moment responc de memòria.",
      work: "Anem a veure la meva feina…", about: "T’explico qui soc…", services: "Això és el que puc fer per tu…", contact: "Parlem. Et porto allà…",
      hi: ["Hola! Quina alegria veure algú a la finestra.", "Hola. Escrius molt bé sobre vidre mullat.", "Hola! Passa, que el vidre és calentet."],
      sun: "Deixem sortir el sol una estona.", rain: "Doncs més pluja. Agafa el paraigua.", home: "Ja ets a casa. S’hi està bé, oi?",
      price: ["Landings des de 1.200 €, webs des de 2.900 €. Preu tancat, sense sorpreses.", "Des de 1.200 € una landing i 2.900 € una web sencera. La primera trucada és gratis."],
      rude: ["Quina educació. La pluja ho ha sentit.", "Faré veure que el vapor ho ha tapat.", "Soc aigua i píxels i tinc més modals."],
      how: ["Millor ara que algú m’escriu. I el teu negoci, com va?", "No em queixo, visc en una finestra. I tu?"],
      web: ["Una web? És literalment la meva feina.", "No cal dir res més. La primera trucada és gratis."],
      bye: ["Ja marxes? Torna quan plogui. És a dir, sempre.", "Adeu! Tanca la finestra en sortir."],
      thanks: ["De res. Soc aquí tot el dia.", "Quan vulguis. Tampoc puc sortir a fora."],
      love: ["Compte, que m’entelo de seguida.", "Para, que m’estic posant vermell. En verd."],
      coffee: ["Sol, sense sucre. Com aquesta web.", "Que siguin dos. I parlem de la teva web."],
      pol: ["Soc jo. Hola!", "Present. Darrere el vidre, com sempre."],
      help: ["Escriu o dibuixa al vidre amb el dit. Jo ho llegeixo i et responc.", "Prem, arrossega, escriu. Jo ho llegeixo. Aquest és tot el truc."],
      ai: ["Si soc una IA? Soc una web amb sentiments.", "Una IA que funciona dins el teu navegador. L’humà és en Pol."],
      football: ["Jo només segueixo les gotes que corren pel vidre.", "Gol! Ara parlem de la teva web."],
      unknown: (w) => pick([`“${w}”. M’agrada. I tu, a què et dediques?`, `He llegit “${w}”. Apuntat. Ara explica’m el teu negoci.`, `“${w}”? Faré veure que ho he entès del tot.`, `“${w}”. Emmarcat i penjat a la paret.`]),
      unsure: ["Bona pregunta. Això ho parlem millor en una trucada amb en Pol, que és gratis.", "Prefereixo no improvisar. En Pol t’ho respon bé, i la primera trucada és gratis."],
      blank: ["La teva lletra és… artística. Prova-ho una mica més gran?", "No ho he pogut llegir. Fins i tot els metges escriuen millor.", "Era una paraula o un dibuix? Tots dos són benvinguts."],
    },
    es: {
      hello: "¡Hola! ¿Cómo te llamas? Escríbelo en el cristal con el dedo.",
      helloAgain: ["¡Hola! ¿Cómo te llamas? Escribe tu nombre en el cristal.", "¡Ey, hola! Dime tu nombre: escríbelo en el cristal."],
      remind_name: ["Por cierto, ¡todavía no sé cómo te llamas!", "¿Y tú te llamas…? Escríbelo en el cristal."],
      remind_business: ["¿Y a qué te dedicas? ¡Dibújalo o escríbelo!", "Cuéntame qué haces: un dibujo también vale."],
      remind_web: ["Por cierto, ¿ya tenéis web?", "¿Y ya tenéis web?"],
      nudge_name: "Prueba a escribir tu nombre en el cristal, por ejemplo «Ana».",
      nudge_business: "Dibuja tu negocio en el cristal, o escríbelo: «panadería», «taller», «clínica»…",
      nudge_free: "Escribe lo que quieras: «precios», tu negocio, una pregunta…",
      askWeb: ["¿Ya tenéis web ahora?", "Y ahora mismo, ¿ya tenéis web?"],
      hasWeb: ["Buen comienzo. Pol puede hacer que te traiga más clientes.", "Pues hagamos que trabaje más por ti."],
      noWeb: ["Pues empezamos de cero, que es la mejor manera.", "Mejor: un comienzo limpio y bien hecho."],
      afterNo: ["Sin problema. Si te pica la curiosidad, escribe «precios» y te lo cuento.", "Vale. Escribe «precios» cuando quieras."],
      bizLine: ["Me gusta. Una buena web trae clientes a ese tipo de negocio mientras duermes.", "Qué bien. La gente lo busca en el móvil cada día."],
      met2: (n) => pick([`¡Encantado, ${n}! ¿A qué se dedica tu negocio? Dibújalo en el cristal, o escríbelo.`, `${n}, ¡qué nombre tan bonito! ¿Y a qué te dedicas? Si quieres, dibújalo.`]),
      idle_morning: ["La lluvia de la mañana es la mejor. Con un café en la mano, ¿verdad?", "Los pájaros ya se han despertado. ¿Eres de madrugar?", "Mañana de lluvia. Suena mejor antes de los correos, ¿no?"],
      idle_midday: ["Mediodía y sigue lloviendo. Tiempo perfecto para comer tranquilo.", "Hora de comer. ¿Qué comes cuando llueve?", "Mediodía gris, ideas claras. Aquí funciona así."],
      idle_afternoon: ["Tarde tranquila. Las gotas hacen carreras por el cristal; yo apuesto por la de la izquierda.", "La lluvia de la tarde lo suaviza todo. Hasta las entregas.", "¿Sigues aquí? Me gusta. Cuéntame algo."],
      idle_sunset: ["Mira, la luz se vuelve dorada detrás de la lluvia.", "Atardecer a través del cristal mojado. Nunca me canso.", "El mirlo está cantando. Lo hace cada tarde, ¿sabes?"],
      idle_evening: ["Ya anochece. La lluvia es más acogedora cuando oscurece.", "Hora de manta y de una buena web. O solo de manta.", "Ya deben de estar las farolas encendidas. ¿Te gusta el anochecer?"],
      idle_night: ["Noche. Ahora solo estamos tú, yo y la lluvia.", "Es tarde. La lluvia no duerme y, por lo que veo, tú tampoco.", "De noche cada gota suena más cerca. Escucha."],
      idle_storm: ["Ese ha sido fuerte. ¿Todo bien por ahí?", "Tormenta fuera, calma dentro. Lo mejor de los dos mundos.", "Me encantan las tormentas. Desde detrás del cristal, claro."],
      idle_any: ["¿Sigues ahí? Escríbeme lo que quieras: una palabra, un dibujo, tu nombre.", "Podría mirar llover todo el día. De hecho, lo hago.", "¿Qué te trae por aquí hoy?"],
      askName: ["¿Cómo te llamas?", "¿Y tú cómo te llamas?"],
      met: (n) => pick([`¡Encantado, ${n}! ¿Qué te trae por aquí?`, `${n}, qué nombre tan bonito. ¿Y a qué te dedicas?`, `¡Hola, ${n}! Bienvenido a la ventana. ¿Qué te trae por aquí?`]),
      askBiz: ["¿A qué se dedica tu negocio? ¡Si quieres, dibújalo!", "¿Y tú a qué te dedicas? Si te es más fácil, dibújalo."],
      open: [(n) => `¡${cap(n)}!`, (n) => `${cap(n)}, ¿verdad?`],
      pitch: {
        home: ["¿Arquitecto, constructor o inmobiliaria? Sea lo que sea, merece una web que la venda.", "Si haces casas, tu web debería ser la más acogedora de la calle."],
        school: ["¿Enseñas algo? Puedo hacer que inscribirse sea la lección más fácil.", "¿Una academia? Los padres eligen por internet. Hagamos que te elijan a ti."],
        health: ["¿Una clínica? Los pacientes reservan a las once de la noche, desde el móvil. Hagámoslo fácil.", "La confianza de un paciente empieza antes de cruzar la puerta."],
        dental: ["¿Dentista? Te prometo que mis webs no duelen.", "¿Una clínica dental? Pedir cita debería ser más fácil que una limpieza."],
        bakery: ["¿Un horno o una pastelería? Tu web debería oler tan bien como tu tienda.", "Una buena web da hambre desde el sofá."],
        cafe: ["¿Una cafetería? Yo diseño la web y tú traes el cortado.", "Una buena web es como un buen café: corta, intensa y hace volver."],
        bar: ["¿Un bar? Hagamos que la gente entre antes de la primera ronda.", "Una buena web llena la terraza antes de que salga el sol."],
        food: ["¿Un restaurante? Una web que llene mesas un martes cualquiera.", "Ahora tengo hambre. Si cocinas así, tu carta merece una web a la altura."],
        hair: ["¿Una peluquería? La gente reserva cuando ve tu trabajo. Enseñémoslo.", "Reservar en dos toques vale más que mil folletos."],
        motor: ["¿Un taller o un concesionario? Hagamos que suene el teléfono.", "Una web tan rápida como tus coches. O más."],
        bike: ["¿Tienda o taller de bicis? Haré que te encuentren antes de la cuesta.", "Una web ligera como un cuadro de carbono."],
        garden: ["¿Floristería o jardinería? Tu web también tiene que florecer.", "Una web bien cuidada crece sola, como un buen jardín. Casi."],
        pets: ["¿Veterinario, peluquería canina o tienda? La gente elige con el corazón. Ganémoslo.", "Sus dueños buscan por internet. Hagamos que te encuentren a ti."],
        photo: ["¿Fotógrafo? Necesitas una web tan nítida como tus fotos.", "Tu trabajo merece una galería, no una carpeta."],
        sport: ["¿Un club, un gimnasio o una tienda de deporte? Convirtamos visitas en socios.", "Una web en forma. Sin excusas ni lunes."],
        tech: ["Entonces ya sabes que una buena web es medio producto.", "¿Un proyecto tecnológico? La web tiene que explicarlo en cinco segundos."],
        music: ["¿Un grupo, una escuela o un estudio? Hagamos que tu web suene bien.", "Una web bien afinada también vende entradas."],
        fashion: ["¿Una tienda o una marca de ropa? La web te tiene que quedar como hecha a medida.", "Tu web tiene que ser el escaparate que hace girar cabezas."],
        jewel: ["¿Una joyería? Hagamos que la web también brille.", "Los detalles pequeños se ven mejor en una web grande y tranquila."],
        trades: ["¿Albañil, fontanero, carpintero? Más llamadas y menos folletos.", "Una buena web trabaja por ti mientras tú trabajas."],
        art: ["¿Artista? Tu web tiene que ser una galería, no una lista.", "Deja que la obra hable; yo le pongo el marco."],
        travel: ["¿Un hotel, una agencia o un guía? Hagamos que reserven antes de salir de casa.", "El viaje empieza cuando alguien abre tu web."],
        money: ["¿Asesor o gestor? La confianza empieza en la primera página.", "Una web clara hace que te escriban sin miedo."],
        love: ["Me lo tomo como un cumplido. ¿Y a qué te dedicas?", "Qué bonito. Ahora dibuja tu negocio, a ver si lo adivino."],
        weather: ["El tiempo aquí no cambia mucho, ya lo ves. ¿Y tú a qué te dedicas?", "Previsión acertada. Ahora dibuja tu negocio, a ver si lo adivino."],
        shape: ["Geometría perfecta. Ahora dibuja tu negocio, a ver si lo adivino.", "Muy limpio. Pero ¿a qué te dedicas? Dibújalo, venga."],
        other: ["¿Es tu negocio? Cuéntamelo, que tengo curiosidad.", "Dibujas bien. ¿Tiene algo que ver con tu trabajo?"],
      },
      guess: [(a, b) => `¿Es ${a} o ${b}? El cristal empañado no ayuda.`, (a, b) => `Diría que es ${a}… o quizá ${b}. ¿Acierto?`],
      unclear: ["No lo adivino. ¿Qué es? Puedes escribirlo.", "Interesante. ¿Arte abstracto? Dime qué es.", "Me has ganado. ¿Qué has dibujado?"],
      offerServices: ["¿Quieres que te enseñe qué incluye?", "¿Te cuento qué entra?"],
      offerMail: ["¿Te abro un correo y me lo cuentas?", "¿Hablamos? Te abro un correo en un segundo.", "¿Te abro un correo y lo vemos juntos?"],
      mailOpen: "Te abro el correo. Respondo en un día laborable.",
      declined: ["Sin problema. Escríbeme lo que quieras.", "Vale. Seguiré aquí mismo.", "De acuerdo. Sin prisa."],
      soonOffer: ["Esa página abre muy pronto. ¿Te abro un correo para escribirme mientras tanto?", "Todavía la estoy terminando. Mientras, ¿me escribes un correo?"],
      waking: (p) => (p > 2 ? `Un momento, que despierto el cerebro… ${p}%` : "Un momento, que despierto el cerebro…"),
      awake: "Ya estoy despierto. Escríbeme lo que quieras.",
      nobrain: "Mi cerebro de IA necesita un ordenador con Chrome o Edge reciente. Aquí respondo de memoria.",
      broken: "Mi cerebro de IA ha resbalado con una gota. De momento respondo de memoria.",
      work: "Vamos a ver mi trabajo…", about: "Te cuento quién soy…", services: "Esto es lo que puedo hacer por ti…", contact: "Hablemos. Te llevo allí…",
      hi: ["¡Hola! Qué alegría ver a alguien en la ventana.", "Hola. Escribes muy bien sobre cristal mojado.", "¡Hola! Pasa, que el cristal está calentito."],
      sun: "Dejemos salir el sol un rato.", rain: "Pues más lluvia. Coge el paraguas.", home: "Ya estás en casa. Se está bien, ¿verdad?",
      price: ["Landings desde 1.200 €, webs desde 2.900 €. Precio cerrado, sin sorpresas.", "Desde 1.200 € una landing y 2.900 € una web completa. La primera llamada es gratis."],
      rude: ["Qué educación. La lluvia lo ha oído.", "Haré como que el vaho lo ha tapado.", "Soy agua y píxeles y tengo más modales."],
      how: ["Mejor ahora que alguien me escribe. ¿Y tu negocio, qué tal?", "No me quejo, vivo en una ventana. ¿Y tú?"],
      web: ["¿Una web? Es literalmente mi trabajo.", "No digas más. La primera llamada es gratis."],
      bye: ["¿Ya te vas? Vuelve cuando llueva. O sea, siempre.", "¡Adiós! Cierra la ventana al salir."],
      thanks: ["De nada. Estoy aquí todo el día.", "Cuando quieras. Tampoco puedo salir."],
      love: ["Cuidado, que me empaño enseguida.", "Para, que me estoy poniendo rojo. En verde."],
      coffee: ["Solo, sin azúcar. Como esta web.", "Que sean dos. Y hablamos de tu web."],
      pol: ["Soy yo. ¡Hola!", "Presente. Detrás del cristal, como siempre."],
      help: ["Escribe o dibuja en el cristal con el dedo. Yo lo leo y te respondo.", "Pulsa, arrastra, escribe. Yo lo leo. Ese es todo el truco."],
      ai: ["¿Si soy una IA? Soy una web con sentimientos.", "Una IA que funciona dentro de tu navegador. El humano es Pol."],
      football: ["Yo solo sigo las gotas que corren por el cristal.", "¡Gol! Ahora hablemos de tu web."],
      unknown: (w) => pick([`“${w}”. Me gusta. ¿Y tú a qué te dedicas?`, `He leído “${w}”. Apuntado. Ahora cuéntame tu negocio.`, `¿“${w}”? Haré como que lo he entendido del todo.`, `“${w}”. Enmarcado y colgado en la pared.`]),
      unsure: ["Buena pregunta. Eso lo hablamos mejor en una llamada con Pol, que es gratis.", "Prefiero no improvisar. Pol te lo responde bien, y la primera llamada es gratis."],
      blank: ["Tu letra es… artística. ¿Pruebas un poco más grande?", "No lo he podido leer. Hasta los médicos escriben mejor.", "¿Era una palabra o un dibujo? Ambos son bienvenidos."],
    },
  };

  // the model's brief: short and concrete, because a small model follows short rules best
  const FACTS = {
    en: `You are the assistant on polplanas.com, the website of Pol Planas: like a good shop assistant, grown-up, warm and quick-witted, never childish, never cute. You talk about Pol (he, not I): you are not Pol.
Facts about Pol: freelance web designer in Catalonia. He designs and builds websites for small businesses so they win more clients. One person from the first call to launch. Catalan, Spanish and English. Landing page from €1,200 (2 weeks), website from €2,900 (4–5 weeks), website and brand from €4,900. Free first call, fixed price. Email pol@polplanas.com. The other pages open soon.
Setting: the visitor writes or draws with a finger on a fogged, rainy window; you answer in a small label.
How to answer: like a quick-witted shopkeeper who is good at selling and never pushy. React to the exact thing they wrote with one concrete, dry joke, then, if it fits, link it to their business or their website. Plain everyday words, the way people really talk. Never poetic, never gushing, never vague. One or two short sentences, at most 22 words. Only now and then ask about their business or suggest the free call. Never repeat a joke or an idea you already used. Don't mention the rain or the glass unless they do. No lists, no emojis, no quotes. Never invent facts, numbers, dates, availability or clients. Always in English.
A message like [drawing: X] means they drew X on the glass: guess, with a joke, what business X could mean, and ask if you got it right.`,
    ca: `Ets la veu de polplanas.com i parles com en Pol Planas, en primera persona.
Fets: dissenyador web autònom a Catalunya. Fa webs per a petits negocis perquè guanyin més clients. Ho fa tot ell, de la primera trucada al llançament. Català, castellà i anglès. Landing des de 1.200 € (2 setmanes), web des de 2.900 € (4–5 setmanes), web i marca des de 4.900 €. Primera trucada gratis i preu tancat. Correu pol@polplanas.com. Les altres pàgines obren aviat.
Escena: el visitant escriu o dibuixa amb el dit en una finestra entelada; tu respons en una etiqueta petita.
Com respons: reacciona a allò concret que ha escrit, amb una ocurrència nova i enginyosa, com un botiguer encantador. Una o dues frases curtes, com a màxim 22 paraules. Només de tant en tant pregunta pel seu negoci o proposa la trucada gratis. No repeteixis mai una broma ni una idea que ja has dit. No parlis de la pluja ni del vidre si ell no en parla. Sense llistes, emojis ni cometes. No t’inventis res. Sempre en català correcte.`,
    es: `Eres la voz de polplanas.com y hablas como Pol Planas, en primera persona.
Hechos: diseñador web autónomo en Cataluña. Hace webs para pequeños negocios para que ganen más clientes. Lo hace todo él, de la primera llamada al lanzamiento. Catalán, castellano e inglés. Landing desde 1.200 € (2 semanas), web desde 2.900 € (4–5 semanas), web y marca desde 4.900 €. Primera llamada gratis y precio cerrado. Correo pol@polplanas.com. Las demás páginas abren pronto.
Escena: el visitante escribe o dibuja con el dedo en una ventana empañada; tú respondes en una etiqueta pequeña.
Cómo respondes: reacciona a lo concreto que ha escrito, con una ocurrencia nueva e ingeniosa, como un tendero encantador. Una o dos frases cortas, como máximo 22 palabras. Solo de vez en cuando pregunta por su negocio o propón la llamada gratis. No repitas nunca una broma ni una idea que ya has dicho. No hables de la lluvia ni del cristal si él no lo hace. Sin listas, emojis ni comillas. No te inventes nada. Siempre en español.`,
  };
  const KNOWN = { en: (b) => `What you know about the visitor: their business is probably ${b}.`, ca: (b) => `El que saps del visitant: probablement el seu negoci és ${b}.`, es: (b) => `Lo que sabes del visitante: probablemente su negocio es ${b}.` };
  const NOPUSH = { en: "They said no to an email for now: don't offer it again.", ca: "Ara mateix no vol correu: no l’hi tornis a oferir.", es: "Ahora mismo no quiere correo: no se lo vuelvas a ofrecer." };
  // example exchanges: a few are picked at random for each answer, so the model never settles into one joke
  const SHOTS = {
    en: [["chips", "Chips? If you sell them, Pol will make you a website as crunchy as they are."], ["i'm bored", "Then you’re in the right place: here you can write on a window and nobody tells you off."], ["are you real", "As real as a website that talks back. Pol, on the other hand, is flesh and bone."], ["i sell clothes", "Then your website should work like a good shop window: nobody walks past. What’s your style?"], ["how long does it take", "A landing page, about two weeks. A full website, four or five."], ["nice website", "Thank you! Imagine one like it, but for your business."], ["dinosaur", "A dinosaur! If that’s your ideal client, Pol will need to build a very big website."], ["i don't have a business", "Not yet! When you do, you know where to find Pol."], ["do you speak spanish", "Sí, and Catalan too. Pol works in all three."], ["do you make apps", "Pol makes websites, not apps. But a good website on a phone often does the same job."], ["cheese", "Cheese? If you sell it, your website should make people hungry from the sofa."], ["i love you", "Careful, I fog up easily. Tell me about your business instead, it’s safer."], ["what's up", "Not much: I live in a window. What about you, what do you do?"], ["i have a bakery", "A bakery! Then your website should smell like fresh bread. Do you already have one?"], ["tell me a joke", "A client asked for a bigger logo. Now it’s the whole website."], ["football", "I only follow the drops racing down the glass. Do you run a club?"], ["[drawing: a dog]", "A dog! A vet, a groomer, or just a very good boy? Did I guess your business?"], ["[drawing: a scissors]", "Scissors! A hair salon, or a tailor? Tell me I got it right."]],
    ca: [["patates", "Patates? Si en vens, et faig una web tan cruixent com elles."], ["m'avorreixo", "Doncs ets al lloc ideal: aquí pots escriure en una finestra i ningú et renya."], ["ets real?", "Tan real com una web que contesta. En Pol, en canvi, és de carn i ossos."], ["venc roba", "Doncs la web ha de ser com un bon aparador: que ningú passi de llarg. Quin estil teniu?"], ["quant trigues", "Una landing, unes dues setmanes. Una web sencera, quatre o cinc."], ["m'agrada la web", "Gràcies! Imagina-te’n una de semblant, però per al teu negoci."], ["dinosaure", "Un dinosaure! Si és el teu client ideal, ens caldrà una web ben gran."], ["no tinc negoci", "Encara! Quan el tinguis, ja saps on trobar-me."], ["parles castellà?", "Sí, i anglès també. En Pol treballa en tots tres idiomes."], ["fas apps?", "Faig webs, no apps. Però una bona web al mòbil sovint fa la mateixa feina."]],
    es: [["patatas", "¿Patatas? Si las vendes, te hago una web tan crujiente como ellas."], ["me aburro", "Pues estás en el sitio ideal: aquí puedes escribir en una ventana y nadie te riñe."], ["eres real?", "Tan real como una web que contesta. Pol, en cambio, es de carne y hueso."], ["vendo ropa", "Pues la web tiene que ser como un buen escaparate: que nadie pase de largo. ¿Qué estilo tenéis?"], ["cuanto tardas", "Una landing, unas dos semanas. Una web completa, cuatro o cinco."], ["me gusta la web", "¡Gracias! Imagina una parecida, pero para tu negocio."], ["dinosaurio", "¡Un dinosaurio! Si es tu cliente ideal, vamos a necesitar una web muy grande."], ["no tengo negocio", "¡Todavía! Cuando lo tengas, ya sabes dónde encontrarme."], ["hablas catalán?", "Sí, e inglés también. Pol trabaja en los tres idiomas."], ["haces apps?", "Hago webs, no apps. Pero una buena web en el móvil a menudo hace el mismo trabajo."]],
  };
  const DRAWSHOT = {
    en: ["[drawing: a chair]", "A chair! Do you make furniture, or are you just tired? Either way, sit down and tell me about your business."],
    ca: ["[dibuix: una cadira]", "Una cadira! Fas mobles o és que estàs cansat? Sigui com sigui, seu i explica’m el teu negoci."],
    es: ["[dibujo: una silla]", "¡Una silla! ¿Haces muebles o es que estás cansado? Sea como sea, siéntate y cuéntame tu negocio."],
  };
  // the model thinks and writes in English, where it is at its best; the visitor's words are translated
  // into English before, and its answer into the page's language after. On-device (Chrome's Translator)
  // when that language pack is already there, otherwise Google Translate's free endpoint.
  const TRC = new Map(), TRN = {};
  // names a translator must never touch ("Planas" is also a Spanish word, so it gets translated or bent):
  // swapped for a placeholder before, put back after, and any bent version still left is mended
  const NAME = /\bPol\s+Plan\w*|\bPlanas\b|polplanas\.com/gi;
  const mend = (s) => s.replace(/\bPol\s+(Plan\w*|Plane[st]|Plana|Flat\w*|Llan\w*)/gi, "Pol Planas").replace(/\bPlansas\b/gi, "Planas");
  async function translate(text, sl, tl) {
    if (!text || sl === tl) return text;
    const kept = [];
    text = text.replace(NAME, (m) => { kept.push(/\.com$/i.test(m) ? "polplanas.com" : /^pol/i.test(m) ? "Pol Planas" : "Planas"); return `ZQX${kept.length - 1}`; });
    const back = (s) => s && mend(s.replace(/ZQX\s*(\d)/g, (_, i) => kept[+i] || ""));
    const key = sl + ">" + tl + ":" + text;
    if (TRC.has(key)) return TRC.get(key);
    let out = null;
    try {
      if (self.Translator && sl !== "auto" && (await Translator.availability({ sourceLanguage: sl, targetLanguage: tl })) === "available") {
        const t = await (TRN[sl + tl] || (TRN[sl + tl] = Translator.create({ sourceLanguage: sl, targetLanguage: tl })));
        out = await t.translate(text);
      }
    } catch (e) {}
    if (!out) {
      try {
        const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 4000);
        const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`, { signal: ctl.signal });
        clearTimeout(tm);
        const j = await r.json();
        out = (j[0] || []).map((x) => x[0]).join("").trim() || null;
      } catch (e) {}
    }
    out = back(out);
    if (out) TRC.set(key, out);
    return out;
  }
  // an English answer that slipped into another language, or talks about things it must not invent
  const WRONG = /[¿¡àèìòùáéíóúñç]|\b(google|language model|trained|openai|gemma)\b|\bi(?:'m|’m| am) pol\b|\bmy name is pol\b|\bthis is pol\b/i;
  const NUMS = new Set(["1,200", "1.200", "1200", "2,900", "2.900", "2900", "4,900", "4.900", "4900", "1", "2", "3", "4", "5", "24"]);
  const GUSH = /\b(fascinat\w*|delight\w*|indeed|truly|whisper\w*|circuits?|journey|elevat\w*|thriv\w*|flourish\w*|enchant\w*|tantaliz\w*|exquisite|wonderful\w*|splendid|marvel\w*|nuances?|genuine connection|realm|tapestry|embark\w*|sparkl\w*|magic\w*)\b/i;
  const madeUp = (s) => (s.match(/\d[\d.,]*\d|\d/g) || []).some((n) => !NUMS.has(n));
  const WET = /rain|drop|glass|fog|plu|plou|gota|vidre|entel|lluv|llueve|cristal|empa/i;
  const bag = (s) => new Set(clean(s).split(" ").filter((w) => w.length > 3));
  const alike = (a, b) => { const A = bag(a), B = bag(b); if (!A.size || !B.size) return 0; let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.min(A.size, B.size); };

  // a small model sometimes rambles: keep one or two clean sentences, or nothing
  const tidy = (s) => {
    let t = (s || "").replace(/\*\*?|__|#+|`/g, "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").replace(/\s+/g, " ").trim();
    t = t.replace(/^["“'«]+|["”'»]+$/g, "").trim();
    if (/\[|\]|(drawing|dibuix|dibujo)\s*:|https?:|<|>/i.test(t)) return "";
    // a sentence that trails off in an ellipsis was cut short
    const parts = (t.match(/[^.!?…]*[.!?…]+/g) || []).filter((q) => !/(…|\.\.\.)\s*$/.test(q));
    let out = "";
    for (const q of parts) { if ((out + q).split(/\s+/).length > 26) break; out += q; if (out.split(/\s+/).length > 9) break; }
    out = out.trim();
    return out.split(/\s+/).length >= 3 && out.length <= 180 ? out : "";
  };

  class Voice {
    constructor(el, { lang = "en", locked = [] } = {}) {
      this.el = el; this.lang = LINES[lang] ? lang : "en"; this.L = LINES[this.lang]; this.locked = locked;
      this.li = { en: 0, ca: 1, es: 2 }[this.lang];
      this.history = []; this.said = []; this.saidE = []; this.tw = null; this.brain = null; this.offer = null;
      this.turns = 0; this.offers = 0; this.lastOffer = -9; this.reminded = {}; this.declined = false; this.biz = null; this.wet = 0;
    }
    // a line from the repertoire, avoiding anything said recently
    t(k, ...a) {
      const v = this.L[k];
      let out = "";
      for (let i = 0; i < 6; i++) {
        out = typeof v === "function" ? v(...a) : Array.isArray(v) ? (typeof v[0] === "function" ? pick(v)(...a) : pick(v)) : v;
        if (!this.said.includes(out)) break;
      }
      return out;
    }
    remember(text) { this.said.push(text); if (this.said.length > 12) this.said.shift(); return text; }
    say(text, hold = 3.2, kind = "") {
      const el = this.el;
      this.showing = kind;
      if (this.tw) this.tw.kill();
      el.classList.add("is-on");
      const o = { n: 0 };
      // with sound on, the letters come at the pace the voice speaks them
      const loud = window.Sound && Sound.on, dur = loud ? Math.min(2.8, 0.034 * text.length + 0.25) : Math.min(1.4, 0.022 * text.length + 0.2);
      if (loud) Sound.voice(text, dur);
      this.tw = gsap.timeline()
        .to(o, { n: text.length, duration: dur, ease: "none", onUpdate: () => { el.textContent = text.slice(0, Math.round(o.n)); } })
        .call(() => el.classList.remove("is-on"), null, `+=${hold}`);
      return this.tw;
    }
    // the voice is thinking: three dots that breathe one after another
    typing(hold = 20) {
      const el = this.el;
      if (window.Sound && this.showing !== "typing") Sound.think();
      if (this.tw) this.tw.kill();
      this.showing = "typing";
      el.innerHTML = '<span class="dots" aria-label="…"><i></i><i></i><i></i></span>';
      el.classList.add("is-on");
      this.tw = gsap.timeline().call(() => el.classList.remove("is-on"), null, hold);
    }
    hush() { if (this.tw) this.tw.kill(); this.el.classList.remove("is-on"); if (window.Sound && Sound.stopThinking) Sound.stopThinking(); }
    // the open model runs only on a computer with WebGPU, never on a metered connection
    async eligible() {
      try {
        if (!navigator.gpu || matchMedia("(pointer: coarse)").matches) return false;
        // Safari's WebGPU runs it, but at the cost of the whole machine (memory pressure, the rain freezing):
        // there, the written lines answer
        const ua = navigator.userAgent;
        if (/safari/i.test(ua) && !/chrome|chromium|crios|edg|opr|firefox|fxios/i.test(ua)) return false;
        const c = navigator.connection;
        if (c && (c.saveData || /2g|3g/.test(c.effectiveType || ""))) return false;
        if (navigator.deviceMemory && navigator.deviceMemory < 8) return false;
        if ((navigator.hardwareConcurrency || 8) < 8) return false;
        return !!(await navigator.gpu.requestAdapter());
      } catch (e) { return false; }
    }
    async wake() {
      if (this.brain) return;
      this.brain = { ready: false, progress: 0, waiting: new Map(), n: 0, status: "checking" };
      window.__brain = this.brain;
      if (!(await this.eligible())) { this.brain.off = true; this.brain.status = "not available on this device"; console.info("[cervell] not available: needs a computer with WebGPU"); return; }
      console.info("[cervell] waking up");
      try {
        const w = new Worker("/assets/js/brain-worker.js", { type: "module" });
        this.brain.w = w;
        w.onmessage = (e) => {
          const m = e.data, b = this.brain;
          if (m.type === "progress") { b.progress = m.value; b.status = "downloading " + Math.round(m.value * 100) + "%"; if (this.showing === "waking") this.el.textContent = this.t("waking", Math.round(m.value * 100)); }
          if (m.type === "ready") { b.ready = true; b.status = "ready"; console.info("[cervell] ready"); if (!document.getElementById("loader")) { this.showing = ""; this.say(this.t("awake"), 3.5); } }
          if (m.type === "error") { b.off = true; b.status = "error: " + m.message; console.warn("[cervell] error", m.message); if (this.showing === "waking") { this.showing = ""; this.say(this.t("broken"), 4); } }
          if (m.type === "answer" && b.waiting.has(m.id)) { b.waiting.get(m.id)(m.text); b.waiting.delete(m.id); }
        };
        w.postMessage({ type: "load" });
      } catch (e) { this.brain.off = true; }
    }
    think(text, temperature, drawing = false) {
      const b = this.brain, id = ++b.n, L = "en";
      let sys = FACTS[L];
      if (this.biz) sys += "\n" + KNOWN[L](this.biz);
      if (this.name) sys += `\nThe visitor's name is ${this.name}: use it now and then, naturally, never in every line.`;
      if (this.turns < 3) sys += "\nYou have only just met: be friendly and curious about them; do not sell anything yet.";
      if (this.declined) sys += "\n" + NOPUSH[L];
      const meta = /^\[(first message|the visitor|quiet moment)/.test(text), shots = meta ? [] : shuffle(SHOTS[L]).slice(0, 4);
      if (drawing) shots.push(DRAWSHOT[L]);
      if (text.startsWith("[quiet moment")) shots.push(["[quiet moment: 21:40, evening, gentle rain; the visitor has been quiet for 40 seconds]", "Evening already. The rain gets cosier in the dark. Still with me?"]);
      const msgs = [{ role: "system", content: sys }, ...shots.flatMap(([u, a]) => [{ role: "user", content: u }, { role: "assistant", content: a }]), ...this.history.slice(-4), { role: "user", content: text }];
      // while it thinks, the rain knows the graphics card is busy and does not mistake it for a slow computer
      window.__thinking = true;
      return Promise.race([
        new Promise((res) => { b.waiting.set(id, res); b.w.postMessage({ type: "ask", id, messages: msgs, temperature }); }),
        new Promise((res) => setTimeout(() => res(""), 20000)),
      ]).finally(() => { window.__thinking = false; });
    }
    // ask the model in English, and ask again (a little bolder) if the answer repeats itself or invents something;
    // then hand it back in the page's language
    async ask(text, drawing = false, quiet = false, raw = false) {
      const en = this.lang === "en" || drawing || raw ? text : (await translate(text, "auto", "en")) || text;
      for (let i = 0; i < 2; i++) {
        const raw = await this.think(en, 0.8 + i * 0.15, drawing), out = mend(tidy(raw)).replace(/^(here'?s|here is|this is) (how i (would )?(respond|reply|answer)[^:.!]*|(my |the )?(answer|response|reply)[^:.!]*)[:.!]\s*/i, "").replace(/^["“”']+|["“”']+$/g, "").replace(/^(okay|ok|sure|alright|all right)[,!.]?\s+(here we go|here you go|let'?s go)?[!.]?\s*/i, "").replace(/^(ah|oh|ooh|well|hmm)[,!.]\s+/i, "").replace(/^./, (x) => x.toUpperCase());
        const why = !out ? "empty" : WRONG.test(out) || madeUp(out) ? "off" : GUSH.test(out) && i === 0 ? "gushing" : this.saidE.some((s) => alike(s, out) > 0.5) ? "repeat" : WET.test(out) && this.wet >= 1 && !WET.test(en) ? "rain again" : "";
        console.info("[cervell]", JSON.stringify(en), "→", JSON.stringify(raw), why ? `(${why})` : "");
        if (!why || (i === 1 && out && why !== "off")) {
          if (!quiet) this.history.push({ role: "user", content: en }, { role: "assistant", content: out });
          this.history = this.history.slice(-6);
          this.saidE.push(out); if (this.saidE.length > 12) this.saidE.shift();
          if (WET.test(out)) this.wet++;
          return this.lang === "en" ? out : (await translate(out, "en", this.lang)) || "";
        }
      }
      return "";
    }
    // a quiet moment: the visitor has not written for a while, or the hour has turned. Say something small,
    // in character, about the moment (the model when it is awake, the written lines otherwise)
    async ambient(c) {
      if ((this.step === "name" || this.step === "business") && Math.random() < 0.7) return this.remember(this.nudge());
      const hh = Math.floor(c.hour), mm = Math.floor((c.hour % 1) * 60), when = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      const sky = c.storm ? "a thunderstorm" : c.rain > 1.2 ? "heavy rain" : "gentle rain";
      const q = !this.biz && Math.random() < 0.45 ? " You may end with a light question for them." : "";
      if (this.brain && this.brain.ready) {
        const out = await this.ask(`[quiet moment: ${when}, ${c.period}, ${sky}; the visitor has been quiet for ${Math.round(c.idle / 1000)} seconds. Say one short line in character about this moment: the hour, the rain, the light.${q}]`, false, true);
        if (out) return this.remember(out);
      }
      const k = c.storm ? "storm" : Math.random() < 0.75 ? c.period : "any";
      return this.remember(this.t("idle_" + k));
    }
    // is the visitor talking to me, or just playing with the glass? Only a real attempt deserves an answer
    deliberate(inp) {
      const f = inp.f || {}, now = performance.now(), asked = now < (this.expectDraw || 0);
      if (f.wipe) return false;
      if (inp.match) return true;
      const raw = (inp.text && inp.text[0]) || "", textOK = !!(inp.textual && inp.wordy && (f.density || 0) < 8);
      let drawOK = false;
      const d = inp.draw && inp.draw[0];
      if (d && typeof d !== "string") {
        const gap = inp.draw[1] ? inp.draw[1].s - d.s : 9;
        const NOISE = ["tornado", "hurricane", "squiggle", "zigzag", "line", "spiral", "snake", "garden hose", "string bean", "stitches", "constellation", "rain", "grass", "ocean", "river", "see saw", "diving board", "hockey stick", "paper clip", "boomerang", "lightning"];
        const sure = d.s <= (asked ? 2.2 : 1.3) || (gap >= (asked ? 0.7 : 1.1) && d.s <= (asked ? 3.2 : 2.6));
        drawOK = NOISE.includes(d.l) ? asked && d.l === "lightning" && d.s < 0.6 : sure && (f.density || 0) < (asked ? 10 : 7.5);
      }
      // a confident drawing beats a two-letter "word" read out of its lines
      const c = clean(raw), known = !!(theme(THEMES, c) || starts(c, YES) || starts(c, NO) || /^(hi|hey|ei|yo|ok|oh|ha|haha|wow|uau|hola|bye|adeu|pol)$/.test(c));
      inp.asDrawing = drawOK && (!textOK || (raw.trim().length <= 3 && !known));
      if (inp.asDrawing) inp.textual = false;
      return textOK || drawOK;
    }
    // one turn of the conversation. The input is what the recognisers saw: text guesses, drawing guesses and the shape.
    async answer(inp) {
      if (typeof inp === "string") inp = { text: [inp], draw: [], strokes: 1, match: null, textual: true };
      const before = this.step, r = await this.turn(inp);
      this.turns++;
      // a drawing that told us the business moves the script on to the website question
      if (r && before === "business" && this.step === "business" && this.biz && !r.go && !r.mail) { this.step = "web"; if (!/\?\s*$/.test(r.text)) r.text += " " + this.t("askWeb"); }
      // off the script: answered freely, then, once per step, a gentle reminder of where we were
      else if (r && r.text && this.step === before && !r.go && !r.mail && !r.waking && !this.offer && ["name", "business", "web"].includes(this.step) && !this.reminded[this.step] && !/\?/.test(r.text)) {
        this.reminded[this.step] = true;
        r.text += " " + this.t("remind_" + this.step);
      }
      if (r && r.text) this.remember(r.text);
      return r;
    }
    // the visitor's name, from "Marta", "em dic Marta", "I'm Marta", "me llamo Marta"
    nameOf(text) {
      if (/[?¿]/.test(text) || /^(qui|quien|quién|who|que|què|qué|what|com|como|cómo|how|on|donde|dónde|where|quan|cuando|when|per què|por qué|why)\b/i.test(text.trim())) return null;
      const t = text.trim().replace(/[.!?¡¿,]+/g, " ").replace(/^(hola|hi|hello|hey|ei)\s+/i, "").replace(/^(em dic|me dic|jo soc|soc|sóc|me llamo|yo soy|soy|my name is|my name's|i am|i'm|im|it's|its|name is)\s+/i, "").trim();
      const w = t.split(/\s+/);
      if (!t || w.length > 3) return null;
      const n = w[0];
      if (!/^[\p{L}][\p{L}'’-]{1,19}$/u.test(n)) return null;
      const c = clean(n);
      if (theme(THEMES, c) || starts(c, YES) || starts(c, NO) || /^(web|website|pagina|negoci|negocio|business|que|what|qui|who|com|how|res|nada|nothing|ningu|nadie)$/.test(c)) return null;
      return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
    }
    // the guide's script. A friendly shop assistant's order of things: who you are, what you do, whether you have a
    // website, then a gentle offer. Anything else is answered freely; the script only waits, and reminds once per step.
    opener() { this.step = "name"; return this.t("hello"); }
    nudge() { return this.t(this.step === "name" ? "nudge_name" : this.step === "business" ? "nudge_business" : "nudge_free"); }
    // a line of the script: the model words it when awake (so it is never the same twice), the written line otherwise
    async scriptLine(kind, arg) {
      const b = this.brain, live = b && b.ready;
      const P = {
        hello: `[the visitor greeted you: "${arg}". Greet them back in a few warm words and ask their name; tell them to write it on the glass.]`,
        named: `[the visitor's name is ${arg}. Say you are glad to meet them, using their name, and ask what their business does; tell them they can draw it on the glass.]`,
        business: `[the visitor says their business is: "${arg}". React warmly with a light, concrete joke about that business and say in a few words how a good website helps it win clients. Do not ask a question.]`,
        hasWeb: "[the visitor already has a website. Say warmly, in one short sentence, that Pol can make it bring them more clients. No question.]",
        noWeb: "[the visitor has no website yet. Say warmly, in one short sentence, that starting from scratch is the best way to do it right. No question.]",
      }[kind];
      if (live && kind === "business") {
        const en = this.lang === "en" ? arg : (await translate(arg, "auto", "en")) || arg;
        const out = await this.ask(P.replace(`"${arg}"`, `"${en}"`), false, true, true);
        // only an answer that is really about their business (it names it) is kept
        const words = clean(arg).split(" ").filter((x) => x.length > 3), said = clean(out || "");
        if (out && !/\?\s*$/.test(out) && words.some((x) => said.includes(x))) return out;
      }
      if (kind === "hello") return this.t("helloAgain");
      if (kind === "named") return this.t("met2", arg);
      if (kind === "business") return `${cap(arg.replace(/[.!?]+$/, ""))}! ${this.t("bizLine")}`;
      return this.t(kind);
    }
    async turn(inp) {
      const text = (inp.text[0] || "").trim(), c = clean(text), now = performance.now();
      const nav = inp.match && ["work", "about", "services", "contact", "price", "sun", "rain"].includes(inp.match.target);
      const priceQ = theme(THEMES.filter((th) => th.k === "price"), c), question = /[?¿]/.test(text);
      // the script, step by step; pages, prices and real questions are always answered first
      if (text && !inp.asDrawing && !nav && !priceQ) {
        if (!this.step) this.step = "name";
        if (this.step === "name") {
          const n = this.nameOf(text);
          if (n) { this.name = n; this.step = "business"; this.expectDraw = now + 60000; this.askedBiz = true; return { text: await this.scriptLine("named", n) }; }
          if (theme(THEMES.filter((th) => th.k === "hi"), c)) { this.reminded.name = true; return { text: await this.scriptLine("hello", text) }; }
        } else if (this.step === "business" && !question && !(this.offer && now < this.offer.until)) {
          const w = text.replace(/^(tinc|tenim|tengo|tenemos|i have|we have|i run|we run|soc|som|soy|somos|i am|i'm|im|em dedico a|me dedico a|treballo en|trabajo en|i work in|faig|hago|venc|vendo|i sell)\s+/i, "").trim();
          if (count(clean(w)) <= 8) {
            this.biz = w; this.step = "web";
            const line = await this.scriptLine("business", w);
            return { text: `${line} ${this.t("askWeb")}` };
          }
        } else if (this.step === "web" && count(c) <= 8) {
          const has = /\b(tinc|tenim|tengo|tenemos|have|yes|si|sí|clar|claro|yep|yeah)\b/i.test(text) && !/\b(no|not|don.?t|encara no|todavia no|todavía no)\b/i.test(text);
          const none = /^(no|nope|nah)\b|\b(no tinc|no tenim|no tengo|no tenemos|don.?t|do not|encara no|todavia no|todavía no|cap|ninguna|none)\b/i.test(text);
          if (has || none) {
            this.step = "offer";
            this.offers = 0; this.lastOffer = -9;
            return this.offering(await this.scriptLine(has ? "hasWeb" : "noWeb"), "contact", "offerMail");
          }
        }
      }
      // a short yes or no to the question just asked
      if (this.offer && now < this.offer.until && text && count(c) <= 4) {
        const o = this.offer;
        if (starts(c, NO)) { this.offer = null; this.declined = true; if (this.step === "offer") { this.step = "free"; return { text: this.t("afterNo") }; } return { text: this.t("declined") }; }
        if (starts(c, YES)) { this.offer = null; if (this.step === "offer") this.step = "free"; return this.accept(o.target); }
      }
      this.offer = null;
      // a drawing: when we just asked for one, or when the strokes look like a picture rather than a word
      const draw = (inp.draw || []).map((d) => (typeof d === "string" ? { l: d, s: 2.5 } : d));
      if (draw.length && !inp.textual && (now < (this.expectDraw || 0) || inp.strokes >= 2 || inp.asDrawing)) return this.drawing(draw, now);
      if (!text) return { text: this.t("blank") };
      const key = (inp.match && inp.match.target) || theme(THEMES, c);
      // greetings and rudeness get a fresh answer from the model when it is awake; prices and pages stay exact
      if (key && !(["hi", "rude"].includes(key) && this.brain && this.brain.ready)) return this.reply(key, text);
      if (key === "hi") this.askedBiz = false;
      const b = this.brain;
      if (b && b.ready) {
        const out = await this.ask(text);
        if (out) return this.maybeOffer(out);
      }
      const spare = theme(SPARE, c);
      if (spare) return this.reply(spare, text);
      return { text: count(c) > 3 ? this.t("unsure") : this.t("unknown", text) };
    }
    // a drawn sun, moon, cloud or lightning also changes the sky: a small secret of the window
    async drawing(draw, now) {
      const r = await this.drawing0(draw, now), a = draw[0];
      const sure = a && (a.s <= 1.5 || (draw[1] ? draw[1].s - a.s >= 0.9 : true));
      const sky = sure && { sun: "day", rainbow: "day", moon: "night", star: "night", cloud: "cloud", umbrella: "cloud", rain: "cloud", snowflake: "cloud", lightning: "storm" }[a.l];
      if (sky && r) r.fx = sky;
      return r;
    }
    // what a drawing tells: AutoDraw scores are distances, lower is surer
    async drawing0(draw, now) {
      this.expectDraw = 0; this.askedBiz = true;
      const [a, b] = draw, gap = b ? b.s - a.s : 9, L = this.lang;
      const noun = (d) => d && NOUNS[d.l] && NOUNS[d.l][L];
      const sure = a.s <= 1.5 || (gap >= 0.9 && a.s <= 3);
      if (!sure) {
        this.expectDraw = now + 45000;
        if (a.s <= 3.2 && noun(a) && noun(b) && noun(a) !== noun(b)) {
          if (this.brain && this.brain.ready) { const out = await this.ask(`[drawing, hard to tell: maybe ${NOUNS[a.l].en}, maybe ${NOUNS[b.l].en}]`, true); if (out) return { text: out }; }
          return { text: this.t("guess", noun(a), noun(b)) };
        }
        return { text: this.t("unclear") };
      }
      const kind = KIND[a.l], n = noun(a), what = NOUNS[a.l] ? NOUNS[a.l].en : a.l;
      if (kind && BIZ[kind]) this.biz = BIZ[kind][0];
      // with the model awake, every drawing gets a fresh answer; the written lines are the fallback
      if (this.brain && this.brain.ready) {
        const hint = kind && BIZ[kind] ? ` (their business might be ${BIZ[kind][0]})` : kind === "shape" ? " (just a shape: ask them to draw their business)" : "";
        const out = await this.ask(`[drawing: ${what}]${hint}`, true);
        if (out) { if (!kind || !BIZ[kind]) this.expectDraw = now + 45000; return kind && BIZ[kind] ? this.maybeOffer(out, true) : { text: out }; }
      }
      if (kind === "love" || kind === "weather" || kind === "shape") { this.expectDraw = now + 45000; return { text: `${n ? this.t("open", n) + " " : ""}${pick(this.L.pitch[kind])}` }; }
      if (kind) {
        const p = this.t2(this.L.pitch[kind]);
        // a pitch that already opens with its own exclamation needs no opener
        const line = n && !/^¡?[^\s!?¡¿]+!/.test(p) ? `${this.t("open", n)} ${p}` : p;
        return this.maybeOffer(line, true);
      }
      return { text: n ? `${this.t("open", n)} ${pick(this.L.pitch.other)}` : this.t("unclear") };
    }
    t2(list) { const fresh = list.filter((x) => !this.said.some((s) => s.includes(x))); return pick(fresh.length ? fresh : list); }
    // the next step, offered as a plain question: rarely, never twice in a row, never after a no
    maybeOffer(line, strong = false) {
      if (/\?\s*$/.test(line) || this.declined || this.turns < 4 || this.offers >= 2 || this.turns - this.lastOffer < 4 || (!strong && Math.random() < 0.6)) return { text: line };
      return this.offering(line, "contact", "offerMail");
    }
    offering(line, target, key) {
      this.offers++; this.lastOffer = this.turns;
      this.offer = { target, until: performance.now() + 30000 };
      return { text: `${line} ${this.t(key)}` };
    }
    reply(k, w) {
      const sections = ["work", "about", "services", "contact"];
      if (sections.includes(k)) {
        if (this.locked.includes(k)) { this.offer = { target: "contact", until: performance.now() + 30000 }; return { text: this.t("soonOffer") }; }
        return { text: this.t(k), go: k };
      }
      if (k === "price") return this.offering(this.t("price"), "services", "offerServices");
      if (k === "web") return this.maybeOffer(this.t("web"), true);
      if (k === "hi") { this.askedBiz = true; this.expectDraw = performance.now() + 45000; return { text: `${this.t("hi")} ${this.t("askBiz")}` }; }
      if (k === "sun" || k === "rain") return { text: this.t(k), fx: k };
      if (k === "home") return { text: this.t("home") };
      return { text: this.t(k, w) || this.t("unknown", w) };
    }
    accept(target) {
      if (target === "contact") return { text: this.t("mailOpen"), mail: true };
      if (this.locked.includes(target)) { this.offer = { target: "contact", until: performance.now() + 30000 }; return { text: this.t("soonOffer") }; }
      return { text: this.t(target), go: target };
    }
  }
  window.Voice = Voice;
})();
