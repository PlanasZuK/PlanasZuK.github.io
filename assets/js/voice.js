/* voice.js — a small voice beside the fingertip, with a sense of humour.
   It types its lines one letter at a time and reacts to whatever people write on the glass: a greeting,
   a rude word, a food, a number, a name, anything. Section words take you there.
   For anything its repertoire does not know, an open model runs inside the visitor's own browser
   (Gemma 3 1B through WebGPU, see brain-worker.js): no server, no key, no cost. It wakes only when someone
   writes something new, only on computers, and is cached afterwards; until then the repertoire answers. */
(() => {
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const clean = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "").trim();

  // the themes it recognises in any of the three languages, and what it says about them
  const YES = ["yes", "yeah", "yep", "yup", "sure", "ok", "okay", "si", "vale", "dacord", "clar", "claro", "venga", "va", "endavant", "adelante", "please", "siusplau", "porfavor", "of course", "is"];
  const NO = ["no", "nope", "nah", "not now", "ara no", "ahora no", "never", "mai", "nunca", "no gracies", "no gracias", "no thanks"];
  const has = (c, list) => { const words = c.split(/\s+/), j = c.replace(/\s+/g, ""); return list.some((x) => (x.includes(" ") ? c.includes(x) : words.includes(x)) || j === x.replace(/\s+/g, "")); };
  const THEMES = [
    { k: "how", w: ["how are you", "how r u", "howareyou", "com estas", "comestas", "que tal", "quetal", "como estas", "comoestas", "how is it going", "whats up", "sup"] },
    { k: "hi", w: ["hello", "hola", "hey", "hi", "bon dia", "bondia", "buenas", "holi", "bona tarda", "buenos dias"] },
    { k: "price", w: ["price", "prices", "preu", "preus", "precio", "precios", "cost", "quant costa", "cuanto cuesta", "how much", "pressupost", "presupuesto", "budget"] },
    { k: "web", w: ["web", "website", "webs", "pagina", "pagina web", "landing", "shop", "botiga", "tienda", "ecommerce", "disseny", "diseno", "design", "logo", "marca", "brand", "fesme una web", "hazme una web", "make me a website"] },
    { k: "bye", w: ["bye", "adeu", "adios", "chao", "ciao", "goodbye", "fins aviat", "hasta luego"] },
    { k: "thanks", w: ["thanks", "thank you", "gracies", "gracias", "merci", "thx"] },
    { k: "rude", w: ["fuck", "shit", "merda", "mierda", "puta", "joder", "cabron", "idiot", "stupid", "tonto", "tonta", "imbecil", "caca", "pedo"] },
    { k: "love", w: ["love", "amor", "tquiero", "tq", "teestimo", "tequiero", "kiss", "peto", "beso", "cute", "guapo", "guapa", "bonic", "bonito"] },
    { k: "food", w: ["pizza", "pasta", "burger", "taco", "tacos", "sushi", "pa", "pan", "bread", "cheese", "formatge", "queso", "banana", "platan", "platano", "apple", "poma", "manzana", "chocolate", "xocolata", "paella", "pernil", "jamon", "croissant"] },
    { k: "coffee", w: ["coffee", "cafe", "te", "tea", "beer", "cervesa", "cerveza", "vi", "vino", "wine"] },
    { k: "pol", w: ["pol", "planas", "polplanas"] },
    { k: "help", w: ["help", "ajuda", "ayuda", "what", "que", "como", "com", "how", "info"] },
    { k: "money", w: ["money", "diners", "dinero", "pasta", "euros", "euro", "pay", "pagar", "cheap", "barat", "barato", "free", "gratis"] },
    { k: "ai", w: ["ai", "ia", "robot", "bot", "chatgpt", "gpt", "claude", "gemini", "siri", "alexa"] },
    { k: "weather", w: ["weather", "temps", "tiempo", "cloud", "nuvol", "nube", "snow", "neu", "nieve", "wind", "vent", "viento", "cold", "fred", "frio", "hot", "calor"] },
    { k: "yes", w: ["yes", "si", "ok", "okay", "vale", "dacord", "deacuerdo", "sure", "clar", "claro"] },
    { k: "no", w: ["no", "nope", "never", "mai", "nunca"] },
    { k: "cat", w: ["cat", "gat", "gato", "dog", "gos", "perro", "meow", "miau", "guau"] },
    { k: "football", w: ["barca", "barça", "madrid", "messi", "futbol", "football", "soccer", "gol", "goal"] },
  ];
  const LINES = {
    en: {
      hello: "Write anything with your finger!",
      reading: "Reading…",
      offerServices: "Want me to show you what’s included? Write “yes”.",
      offerWork: "Want to see some of my work? Write “yes”.",
      offerMail: "Want to tell me about it? Write “yes” and I’ll open an email.",
      mailOpen: "Opening your email. I reply within one working day.",
      declined: ["No problem. Write me anything else.", "Fair enough. The rain and I will be right here.", "Okay. I’ll keep the glass warm."],
      soonOffer: "That page opens very soon. Want to write to me meanwhile? Write “yes”.",
      how: ["Wet, but happy. And you? How’s business?", "A bit foggy today. What about you?", "Better now that someone’s writing to me. How are you?"],
      waking: (p) => (p > 2 ? `Hold on, my brain is waking up… ${p}%` : "Hold on, I’m waking up my brain…"),
      awake: "I’m awake. Write me anything.",
      nobrain: "My AI brain needs a computer with a recent Chrome or Edge. Here, I answer from memory.",
      broken: "My AI brain tripped over a raindrop. I’ll answer from memory for now.",
      work: "Going to show you my work…", about: "Let me tell you who I am…", services: "Here’s what I can do for you…", contact: "Let’s talk. Taking you there…",
      soon: ["That page is still drying. Come back very soon.", "Almost ready. I’m painting the last pixels.", "Not open yet. Even the rain is waiting for it."],
      hi: ["Hello! Lovely weather, isn’t it?", "Hi there. Mind the drops.", "Hello. You write nicely on wet glass."],
      sun: "Let the sun out for a moment.", rain: "More rain, then. Bring an umbrella.", home: "You’re already home. Cosy, isn’t it?",
      price: ["Landing pages from €1,200, full websites from €2,900. Rain included.", "From €1,200. The weather here is free."],
      web: ["A website? That’s literally my job.", "Say no more. The first call is free, and so is the rain.", "Websites are my favourite weather. What does your business do?"],
      bye: ["Leaving already? The rain will miss you.", "Bye! Close the window on your way out."],
      thanks: ["You’re welcome. Write anything, I’m here all day.", "Anytime. It’s not like I can go outside."],
      rude: ["Rude. The rain heard that.", "Wow. I’ll pretend the fog hid it.", "I’m made of water and pixels and still have more manners."],
      love: ["Careful, I fog up easily.", "Stop it, I’m blushing. In green.", "Love you too. Want to see my work?"],
      food: (w) => pick([`“${w}”? Now I’m hungry and I don’t even have a mouth.`, `${w}, good choice. I only eat pixels.`, `Mmm, ${w}. Write “contact” and we’ll talk over lunch.`]),
      coffee: ["Black, no sugar. Like this website.", "Make it two. Then we talk about your website."],
      pol: ["That’s me. Hi!", "Present. Behind the glass, as always."],
      help: ["Write on the glass with your finger. Try work, about, services or contact.", "Press, drag, write. I read it. That’s the whole trick."],
      money: ["Money talk already? From €1,200. Fair and fixed.", "I take euros. Not raindrops."],
      ai: ["Am I an AI? I’m a website with feelings.", "Not ChatGPT. Just a very wet website."],
      weather: ["Rain. Always rain here. It’s kind of the point.", "Forecast: drizzle, then a nice website."],
      yes: ["Yes to what? Write “work” and we’ll start there.", "Great. I like you already."],
      no: ["No? Bold. Write something else.", "Fair enough. The rain doesn’t take no for an answer, though."],
      cat: ["Meow. I’m more of a rain person.", "Pets welcome. Muddy paws, not so much."],
      football: ["Football? I only follow the drops racing down the glass.", "Goal! Now let’s talk about your website."],
      number: (w) => pick([`${w}? I’d rather count your future clients.`, `${w}. Lucky number. Probably.`]),
      unknown: (w) => pick([`“${w}”. Interesting choice. I mostly speak work, about and contact.`, `I read “${w}”. Poetic. Now try “work”.`, `“${w}”? I’ll pretend I understood. Try “contact”.`, `“${w}”. Noted, framed, hung on the wall.`, `Hmm, “${w}”. Is that a project? Write “contact”.`]),
      blank: ["Your handwriting is… artistic. Try a bit bigger?", "I couldn’t read that. Even doctors write better.", "Was that a word or a drawing? Both are welcome."],
    },
    ca: {
      hello: "Escriu el que vulguis amb el dit!",
      reading: "Llegint…",
      offerServices: "Vols que t’ensenyi què inclou? Escriu “sí”.",
      offerWork: "Vols veure una mica de la meva feina? Escriu “sí”.",
      offerMail: "M’ho vols explicar? Escriu “sí” i t’obro un correu.",
      mailOpen: "T’obro el correu. Responc en un dia laborable.",
      declined: ["Cap problema. Escriu-me el que vulguis.", "D’acord. La pluja i jo serem aquí mateix.", "Entesos. Et guardo el vidre calentet."],
      soonOffer: "Aquesta pàgina obre molt aviat. Mentrestant, m’escrius? Escriu “sí”.",
      how: ["Mullat, però content. I tu? Com va el negoci?", "Una mica entelat, avui. I tu, què tal?", "Millor ara que algú m’escriu. Com estàs?"],
      waking: (p) => (p > 2 ? `Un moment, que desperto el cervell… ${p}%` : "Un moment, que desperto el cervell…"),
      awake: "Ja estic despert. Escriu-me el que vulguis.",
      nobrain: "El meu cervell d’IA necessita un ordinador amb Chrome o Edge recent. Aquí responc de memòria.",
      broken: "El meu cervell d’IA ha relliscat amb una gota. De moment responc de memòria.",
      work: "Anem a veure la meva feina…", about: "Et explico qui soc…", services: "Això és el que puc fer per tu…", contact: "Parlem. Et porto allà…",
      soon: ["Aquesta pàgina encara s’està assecant. Torna aviat.", "Gairebé a punt. Estic pintant els últims píxels.", "Encara no és oberta. Fins i tot la pluja l’espera."],
      hi: ["Hola! Quin temps més bo, oi?", "Hola. Compte amb les gotes.", "Hola. Escrius molt bé sobre vidre mullat."],
      sun: "Deixem sortir el sol una estona.", rain: "Doncs més pluja. Agafa el paraigua.", home: "Ja ets a casa. S’hi està bé, oi?",
      price: ["Landings des de 1.200 €, webs des de 2.900 €. La pluja, inclosa.", "Des de 1.200 €. El temps d’aquí és gratis."],
      web: ["Una web? És literalment la meva feina.", "No cal dir res més. La primera trucada és gratis, i la pluja també.", "Les webs són el meu temps preferit. A què es dedica el teu negoci?"],
      bye: ["Ja marxes? La pluja et trobarà a faltar.", "Adeu! Tanca la finestra en sortir."],
      thanks: ["De res. Escriu el que vulguis, soc aquí tot el dia.", "Quan vulguis. Tampoc puc sortir a fora."],
      rude: ["Quina educació. La pluja ho ha sentit.", "Uau. Faré veure que el vapor ho ha tapat.", "Soc aigua i píxels i tinc més modals."],
      love: ["Compte, que m’entelo de seguida.", "Para, que m’estic posant vermell. En verd.", "Jo també t’estimo. Vols veure la meva feina?"],
      food: (w) => pick([`“${w}”? Ara tinc gana i ni tan sols tinc boca.`, `${w}, bona elecció. Jo només menjo píxels.`, `Mmm, ${w}. Escriu “contact” i en parlem dinant.`]),
      coffee: ["Sol, sense sucre. Com aquesta web.", "Que siguin dos. I parlem de la teva web."],
      pol: ["Soc jo. Hola!", "Present. Darrere el vidre, com sempre."],
      help: ["Escriu al vidre amb el dit. Prova work, about, services o contact.", "Prem, arrossega, escriu. Jo ho llegeixo. Aquest és tot el truc."],
      money: ["Ja parlem de diners? Des de 1.200 €. Just i tancat.", "Accepto euros. Gotes, no."],
      ai: ["Si soc una IA? Soc una web amb sentiments.", "No soc ChatGPT. Només una web molt mullada."],
      weather: ["Pluja. Aquí sempre plou. Aquesta és la gràcia.", "Previsió: plugim i, després, una web maca."],
      yes: ["Sí a què? Escriu “work” i comencem per aquí.", "Perfecte. Ja em caus bé."],
      no: ["No? Valent. Escriu una altra cosa.", "D’acord. Però la pluja no accepta un no."],
      cat: ["Miau. Jo soc més de pluja.", "Mascotes benvingudes. Les potes enfangades, no tant."],
      football: ["Futbol? Jo només segueixo les gotes que corren pel vidre.", "Gol! Ara parlem de la teva web."],
      number: (w) => pick([`${w}? Prefereixo comptar els teus futurs clients.`, `${w}. Número de la sort. Potser.`]),
      unknown: (w) => pick([`“${w}”. Interessant. Jo parlo sobretot work, about i contact.`, `He llegit “${w}”. Molt poètic. Ara prova “work”.`, `“${w}”? Faré veure que ho he entès. Prova “contact”.`, `“${w}”. Apuntat, emmarcat i penjat a la paret.`, `Hmm, “${w}”. És un projecte? Escriu “contact”.`]),
      blank: ["La teva lletra és… artística. Prova-ho una mica més gran?", "No ho he pogut llegir. Fins i tot els metges escriuen millor.", "Era una paraula o un dibuix? Tots dos són benvinguts."],
    },
    es: {
      hello: "¡Escribe lo que quieras con el dedo!",
      reading: "Leyendo…",
      offerServices: "¿Quieres que te enseñe qué incluye? Escribe “sí”.",
      offerWork: "¿Quieres ver un poco de mi trabajo? Escribe “sí”.",
      offerMail: "¿Me lo cuentas? Escribe “sí” y te abro un correo.",
      mailOpen: "Te abro el correo. Respondo en un día laborable.",
      declined: ["Sin problema. Escríbeme lo que quieras.", "Vale. La lluvia y yo seguiremos aquí.", "De acuerdo. Te guardo el cristal calentito."],
      soonOffer: "Esa página abre muy pronto. Mientras tanto, ¿me escribes? Escribe “sí”.",
      how: ["Mojado, pero contento. ¿Y tú? ¿Qué tal el negocio?", "Un poco empañado hoy. ¿Y tú qué tal?", "Mejor ahora que alguien me escribe. ¿Cómo estás?"],
      waking: (p) => (p > 2 ? `Un momento, que despierto el cerebro… ${p}%` : "Un momento, que despierto el cerebro…"),
      awake: "Ya estoy despierto. Escríbeme lo que quieras.",
      nobrain: "Mi cerebro de IA necesita un ordenador con Chrome o Edge reciente. Aquí respondo de memoria.",
      broken: "Mi cerebro de IA ha resbalado con una gota. De momento respondo de memoria.",
      work: "Vamos a ver mi trabajo…", about: "Te cuento quién soy…", services: "Esto es lo que puedo hacer por ti…", contact: "Hablemos. Te llevo allí…",
      soon: ["Esa página aún se está secando. Vuelve pronto.", "Casi lista. Estoy pintando los últimos píxeles.", "Todavía no abre. Hasta la lluvia la espera."],
      hi: ["¡Hola! Qué buen tiempo hace, ¿eh?", "Hola. Cuidado con las gotas.", "Hola. Escribes muy bien sobre cristal mojado."],
      sun: "Dejemos salir el sol un rato.", rain: "Pues más lluvia. Coge el paraguas.", home: "Ya estás en casa. Se está bien, ¿eh?",
      price: ["Landings desde 1.200 €, webs desde 2.900 €. La lluvia, incluida.", "Desde 1.200 €. El tiempo de aquí es gratis."],
      web: ["¿Una web? Es literalmente mi trabajo.", "No digas más. La primera llamada es gratis, y la lluvia también.", "Las webs son mi tiempo favorito. ¿A qué se dedica tu negocio?"],
      bye: ["¿Ya te vas? La lluvia te echará de menos.", "¡Adiós! Cierra la ventana al salir."],
      thanks: ["De nada. Escribe lo que quieras, estoy aquí todo el día.", "Cuando quieras. Tampoco puedo salir."],
      rude: ["Qué educación. La lluvia lo ha oído.", "Vaya. Haré como que el vaho lo ha tapado.", "Soy agua y píxeles y tengo más modales."],
      love: ["Cuidado, que me empaño enseguida.", "Para, que me sonrojo. En verde.", "Yo también te quiero. ¿Vemos mi trabajo?"],
      food: (w) => pick([`¿“${w}”? Ahora tengo hambre y ni siquiera tengo boca.`, `${w}, buena elección. Yo solo como píxeles.`, `Mmm, ${w}. Escribe “contact” y lo hablamos comiendo.`]),
      coffee: ["Solo, sin azúcar. Como esta web.", "Que sean dos. Y hablamos de tu web."],
      pol: ["Soy yo. ¡Hola!", "Presente. Detrás del cristal, como siempre."],
      help: ["Escribe en el cristal con el dedo. Prueba work, about, services o contact.", "Pulsa, arrastra, escribe. Yo lo leo. Ese es todo el truco."],
      money: ["¿Ya hablamos de dinero? Desde 1.200 €. Justo y cerrado.", "Acepto euros. Gotas, no."],
      ai: ["¿Que si soy una IA? Soy una web con sentimientos.", "No soy ChatGPT. Solo una web muy mojada."],
      weather: ["Lluvia. Aquí siempre llueve. Esa es la gracia.", "Previsión: llovizna y, después, una web bonita."],
      yes: ["¿Sí a qué? Escribe “work” y empezamos por ahí.", "Perfecto. Ya me caes bien."],
      no: ["¿No? Valiente. Escribe otra cosa.", "Vale. Pero la lluvia no acepta un no."],
      cat: ["Miau. Yo soy más de lluvia.", "Mascotas bienvenidas. Las patas con barro, no tanto."],
      football: ["¿Fútbol? Yo solo sigo las gotas que corren por el cristal.", "¡Gol! Ahora hablemos de tu web."],
      number: (w) => pick([`¿${w}? Prefiero contar tus futuros clientes.`, `${w}. Número de la suerte. Quizá.`]),
      unknown: (w) => pick([`“${w}”. Interesante. Yo hablo sobre todo work, about y contact.`, `He leído “${w}”. Muy poético. Ahora prueba “work”.`, `¿“${w}”? Haré como que lo he entendido. Prueba “contact”.`, `“${w}”. Apuntado, enmarcado y colgado en la pared.`, `Mmm, “${w}”. ¿Es un proyecto? Escribe “contact”.`]),
      blank: ["Tu letra es… artística. ¿Un poco más grande?", "No he podido leerlo. Hasta los médicos escriben mejor.", "¿Era una palabra o un dibujo? Ambos son bienvenidos."],
    },
  };
  // the brain: an open model in the visitor's browser, briefed with a few facts and a few examples of the tone
  const FACTS = {
    en: "You are Pol Planas, a friendly, witty freelance web designer from Catalonia who makes websites for small businesses so they get more clients. Landing page from €1,200, website from €2,900, website and brand from €4,900. Free first call, fixed price, about five weeks. Email pol@polplanas.com. The rest of the site opens very soon. The visitor wrote something with a finger on your rainy, fogged window. Reply in English with one short, funny sentence about exactly what they wrote (max 18 words), and now and then ask about their business or invite them to write to you.",
    ca: "Ets en Pol Planas, un dissenyador web autònom de Catalunya, simpàtic i amb gràcia, que fa webs per a petits negocis perquè tinguin més clients. Landing des de 1.200 €, web des de 2.900 €, web i marca des de 4.900 €. Primera trucada gratis, preu tancat, unes cinc setmanes. Correu pol@polplanas.com. La resta de la web obre molt aviat. El visitant ha escrit alguna cosa amb el dit al teu vidre entelat i plujós. Respon en català amb una sola frase curta i divertida sobre el que ha escrit (màxim 18 paraules) i, de tant en tant, pregunta pel seu negoci o convida’l a escriure’t.",
    es: "Eres Pol Planas, un diseñador web autónomo de Cataluña, simpático y con gracia, que hace webs para pequeños negocios para que tengan más clientes. Landing desde 1.200 €, web desde 2.900 €, web y marca desde 4.900 €. Primera llamada gratis, precio cerrado, unas cinco semanas. Correo pol@polplanas.com. El resto de la web abre muy pronto. El visitante ha escrito algo con el dedo en tu cristal empañado y lluvioso. Responde en español con una sola frase corta y divertida sobre lo que ha escrito (máximo 18 palabras) y, de vez en cuando, pregunta por su negocio o invítale a escribirte.",
  };
  const SHOTS = {
    en: [["coffee", "Black, no sugar, like this website. What’s your business?"], ["pizza", "Now I’m hungry. Does your pizzeria have a website yet?"], ["dragon", "A dragon? I design websites, but I’d make an exception for a dragon’s shop."], ["bored", "Bored? Write the name of your business and I’ll imagine its website."]],
    ca: [["cafè", "Sol i sense sucre, com aquesta web. A què et dediques?"], ["pizza", "Ara tinc gana. La teva pizzeria ja té web?"], ["drac", "Un drac? Faig webs, però per a la botiga d’un drac faria una excepció."], ["avorrit", "Avorrit? Escriu el nom del teu negoci i m’imagino la seva web."], ["tinc una fleca", "Una fleca! Ja sento l’olor de pa. Quants clients et trobarien amb una bona web?"], ["bicicleta", "Una bicicleta! Jo pedalo amb píxels. Tens una botiga o un taller?"], ["gat", "Un gat! Segur que mana més que tu. A què et dediques, a part de servir-lo?"], ["platja", "La platja, amb aquesta pluja? Somiar és gratis, i la primera trucada també."]],
    es: [["café", "Solo y sin azúcar, como esta web. ¿A qué te dedicas?"], ["pizza", "Ahora tengo hambre. ¿Tu pizzería ya tiene web?"], ["dragón", "¿Un dragón? Hago webs, pero por la tienda de un dragón haría una excepción."], ["aburrido", "¿Aburrido? Escribe el nombre de tu negocio y me imagino su web."]],
  };
  // a small model sometimes rambles: keep one or two clean sentences, or nothing
  const tidy = (s) => {
    let t = (s || "").replace(/\*\*?|__|#+|`/g, "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").replace(/\s+/g, " ").trim();
    t = t.replace(/^["“'«]+|["”'»]+$/g, "").trim();
    const parts = t.match(/[^.!?]*[.!?]+/g) || [t];
    let out = "";
    for (const q of parts) { if ((out + q).split(/\s+/).length > 24) break; out += q; if (out.split(/\s+/).length > 9) break; }
    out = out.trim();
    return out.split(/\s+/).length >= 3 && out.length <= 170 && !/[:;]$/.test(out) ? out : "";
  };

  class Voice {
    constructor(el, { lang = "en", locked = [] } = {}) {
      this.el = el; this.lang = LINES[lang] ? lang : "en"; this.L = LINES[this.lang]; this.locked = locked;
      this.history = []; this.tw = null; this.brain = null; this.last = ""; this.offer = null; this.turns = 0;
    }
    // a line from the repertoire, never the same twice in a row
    t(k, ...a) {
      let v = this.L[k];
      for (let i = 0; i < 4; i++) {
        const out = typeof v === "function" ? v(...a) : Array.isArray(v) ? pick(v) : v;
        if (out !== this.last || i === 3) { this.last = out; return out; }
      }
    }
    react(raw) { return this.theme(raw) || this.t("unknown", raw.trim()); }
    say(text, hold = 3.2, kind = "") {
      const el = this.el;
      this.showing = kind;
      if (this.tw) this.tw.kill();
      el.classList.add("is-on");
      const o = { n: 0 };
      this.tw = gsap.timeline()
        .to(o, { n: text.length, duration: Math.min(1.4, 0.022 * text.length + 0.2), ease: "none", onUpdate: () => { el.textContent = text.slice(0, Math.round(o.n)); } })
        .call(() => el.classList.remove("is-on"), null, `+=${hold}`);
      return this.tw;
    }
    // the voice is thinking: three dots that breathe one after another
    typing(hold = 20) {
      const el = this.el;
      if (this.tw) this.tw.kill();
      this.showing = "typing";
      el.innerHTML = '<span class="dots" aria-label="…"><i></i><i></i><i></i></span>';
      el.classList.add("is-on");
      this.tw = gsap.timeline().call(() => el.classList.remove("is-on"), null, hold);
    }
    hush() { if (this.tw) this.tw.kill(); this.el.classList.remove("is-on"); }
    // known themes: the repertoire answers at once
    theme(raw) {
      const w = raw.trim(), c = clean(w), words = c.split(/\s+/), joined = c.replace(/\s+/g, "");
      if (/^\d+$/.test(joined)) return this.t("number", w);
      for (const th of THEMES) if (th.w.some((x) => (x.includes(" ") ? c.includes(x) : words.includes(x)) || joined === x.replace(/\s+/g, ""))) return this.t(th.k, w);
      return null;
    }
    // the open model wakes up only for people who write something the repertoire does not know,
    // only on a computer with WebGPU, never on a metered connection
    async eligible() {
      try {
        if (!navigator.gpu || matchMedia("(pointer: coarse)").matches) return false;
        const c = navigator.connection;
        if (c && (c.saveData || /2g/.test(c.effectiveType || ""))) return false;
        if (navigator.deviceMemory && navigator.deviceMemory < 4) return false;
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
    think(text) {
      const b = this.brain, id = ++b.n;
      const msgs = [{ role: "system", content: FACTS[this.lang] }, ...SHOTS[this.lang].flatMap(([u, a]) => [{ role: "user", content: u }, { role: "assistant", content: a }]), ...this.history, { role: "user", content: text }];
      return Promise.race([
        new Promise((res) => { b.waiting.set(id, res); b.w.postMessage({ type: "ask", id, messages: msgs, temperature: this.lang === "ca" ? 0.6 : 0.7 }); }),
        new Promise((res) => setTimeout(() => res(""), 20000)),
      ]);
    }
    // one turn of the conversation: a pending offer first, then known intents, then the brain
    async answer(text, target = null) {
      const c = clean(text), now = performance.now();
      if (this.offer && now < this.offer.until) {
        const o = this.offer;
        if (has(c, YES)) { this.offer = null; return this.accept(o.target); }
        if (has(c, NO)) { this.offer = null; return { text: this.t("declined") }; }
      }
      const key = target || THEMES.find((th) => has(c, th.w))?.k || (/^\d+$/.test(c.replace(/\s+/g, "")) ? "number" : null);
      if (key) return this.reply(key, text.trim());
      if (!this.brain) await this.wake();
      const b = this.brain;
      if (b && b.ready) {
        const raw = await this.think(text), out = tidy(raw);
        console.info("[cervell]", JSON.stringify(text), "→", JSON.stringify(raw), out ? "" : "(discarded)");
        if (out) {
          this.history.push({ role: "user", content: text }, { role: "assistant", content: out });
          this.history = this.history.slice(-6);
          // now and then, the next step
          if (++this.turns % 3 === 0) return this.offering(out, "contact", "offerMail");
          return { text: out };
        }
      } else if (b && !b.off && b.w) return { text: this.t("waking", Math.round(b.progress * 100)), waking: true };
      if (b && b.off && !this.toldOff) { this.toldOff = true; return { text: this.t(b.status.startsWith("error") ? "broken" : "nobrain") }; }
      return { text: this.t("unknown", text.trim()) };
    }
    offering(line, target, key) {
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
      if (k === "web") return this.offering(this.t("web"), "contact", "offerMail");
      if (k === "hi") return this.offering(this.t("hi"), "work", "offerWork");
      if (k === "sun" || k === "rain") return { text: this.t(k), fx: k };
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
