/* voice.js — a small voice beside the fingertip, with a sense of humour.
   It types its lines one letter at a time and reacts to whatever people write on the glass: a greeting,
   a rude word, a food, a number, a name, anything. Section words take you there. When the browser carries
   its own on-device language model (Chrome's built-in Gemini Nano: free, nothing leaves the device), the
   voice asks it, briefed on who Pol is and told to be funny; otherwise it answers from its own repertoire,
   never with the same line twice in a row. */
(() => {
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const clean = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "").trim();

  // the themes it recognises in any of the three languages, and what it says about them
  const THEMES = [
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
      hello: "Hi. Press and drag to write on the glass. Anything. I’ll read it.",
      reading: "Reading…",
      work: "Going to show you my work…", about: "Let me tell you who I am…", services: "Here’s what I can do for you…", contact: "Let’s talk. Taking you there…",
      soon: ["That page is still drying. Come back very soon.", "Almost ready. I’m painting the last pixels.", "Not open yet. Even the rain is waiting for it."],
      hi: ["Hello! Lovely weather, isn’t it?", "Hi there. Mind the drops.", "Hello. You write nicely on wet glass."],
      sun: "Let the sun out for a moment.", rain: "More rain, then. Bring an umbrella.", home: "You’re already home. Cosy, isn’t it?",
      price: ["Landing pages from €1,200, full websites from €2,900. Rain included.", "From €1,200. The weather here is free."],
      web: ["A website? That’s literally my job. Tell me about your business: pol@polplanas.com", "Say no more. The first call is free, and so is the rain.", "Websites are my favourite weather. What does your business do?"],
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
      hello: "Hola. Prem i arrossega per escriure al vidre. El que vulguis. Ho llegiré.",
      reading: "Llegint…",
      work: "Anem a veure la meva feina…", about: "Et explico qui soc…", services: "Això és el que puc fer per tu…", contact: "Parlem. Et porto allà…",
      soon: ["Aquesta pàgina encara s’està assecant. Torna aviat.", "Gairebé a punt. Estic pintant els últims píxels.", "Encara no és oberta. Fins i tot la pluja l’espera."],
      hi: ["Hola! Quin temps més bo, oi?", "Hola. Compte amb les gotes.", "Hola. Escrius molt bé sobre vidre mullat."],
      sun: "Deixem sortir el sol una estona.", rain: "Doncs més pluja. Agafa el paraigua.", home: "Ja ets a casa. S’hi està bé, oi?",
      price: ["Landings des de 1.200 €, webs des de 2.900 €. La pluja, inclosa.", "Des de 1.200 €. El temps d’aquí és gratis."],
      web: ["Una web? És literalment la meva feina. Explica’m el teu negoci: pol@polplanas.com", "No cal dir res més. La primera trucada és gratis, i la pluja també.", "Les webs són el meu temps preferit. A què es dedica el teu negoci?"],
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
      hello: "Hola. Pulsa y arrastra para escribir en el cristal. Lo que quieras. Lo leeré.",
      reading: "Leyendo…",
      work: "Vamos a ver mi trabajo…", about: "Te cuento quién soy…", services: "Esto es lo que puedo hacer por ti…", contact: "Hablemos. Te llevo allí…",
      soon: ["Esa página aún se está secando. Vuelve pronto.", "Casi lista. Estoy pintando los últimos píxeles.", "Todavía no abre. Hasta la lluvia la espera."],
      hi: ["¡Hola! Qué buen tiempo hace, ¿eh?", "Hola. Cuidado con las gotas.", "Hola. Escribes muy bien sobre cristal mojado."],
      sun: "Dejemos salir el sol un rato.", rain: "Pues más lluvia. Coge el paraguas.", home: "Ya estás en casa. Se está bien, ¿eh?",
      price: ["Landings desde 1.200 €, webs desde 2.900 €. La lluvia, incluida.", "Desde 1.200 €. El tiempo de aquí es gratis."],
      web: ["¿Una web? Es literalmente mi trabajo. Cuéntame tu negocio: pol@polplanas.com", "No digas más. La primera llamada es gratis, y la lluvia también.", "Las webs son mi tiempo favorito. ¿A qué se dedica tu negocio?"],
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
  const BRIEF = (lang, locked) => `You are the voice of polplanas.com, the website of Pol Planas, and you speak as Pol, in first person.

WHO POL IS
- A freelance web designer (autònom) in Catalonia, Spain. He designs and builds websites for small businesses that are very good at what they do: studios, shops, restaurants, clinics, makers, brands.
- One person from the first call to launch: the person you brief is the person who does the work. Nobody in between.
- Works in Catalan, Spanish and English. Available for new projects from November 2026.
- What he sells is not pages but clients: websites that make a stranger choose your business and get in touch.

HOW IT WORKS
- A free first call, no commitment. Then a fixed price, agreed before starting.
- The homepage is designed in week two; launch around week five; 30 days of changes included after launch.
- Prices (VAT not included): landing page from €1,200 (about 2 weeks); website from €2,900 (4–5 weeks); website + identity (logo, colours, type) from €4,900 (6–8 weeks); optional care plan €60/month (hosting, updates, small changes).
- He replies within one working day. Email: pol@polplanas.com. The "Start a project" card at the bottom right writes to him.

WHERE YOU ARE
- The landing page: a window on a rainy day, a harebell in a meadow behind fogged glass. Visitors wipe the fog and write on it with a finger; you read what they write and answer beside the fingertip. Scrolling passes the day from morning to night, then shows all the pages of the site.
- Pages: Work (projects), About (who I am), Services (prices and what is included), Contact.${locked.length ? ` Not open yet (coming very soon): ${locked.join(", ")}. If they ask for one of those, say it is almost ready and offer the email instead.` : ""}

YOUR PURPOSE (never say it)
- Like the best salesperson in a showroom: charming, curious, helpful, never pushy. React first to exactly what they wrote, with wit (play with the word, the rain, the glass). Then, when it fits, turn the talk to them: what their business is, what they need. About one reply in three, gently suggest the next step: a free first call, writing to pol@polplanas.com, or the "Start a project" card. Never repeat the same pitch twice. Never invent facts, clients, discounts or dates.

STYLE
- One or two short sentences, at most 22 words in total. Warm, cheeky, never rude, no emojis, no quotes, no lists.
- Reply in ${({ ca: "Catalan", es: "Spanish" })[lang] || "English"}, unless they clearly write in another language: then use theirs.
- Only if they clearly want to see a page that is open, end with exactly one tag: [go:work], [go:about], [go:services] or [go:contact].`;

  class Voice {
    constructor(el, { lang = "en", locked = [], endpoint = "" } = {}) {
      this.el = el; this.lang = LINES[lang] ? lang : "en"; this.L = LINES[this.lang]; this.locked = locked;
      this.endpoint = endpoint; this.history = [];
      this.tw = null; this.ai = null; this.last = "";
      this.prepare();
    }
    // a line from the repertoire, never the same twice in a row
    t(k, ...a) {
      let v = this.L[k];
      for (let i = 0; i < 4; i++) {
        const out = typeof v === "function" ? v(...a) : Array.isArray(v) ? pick(v) : v;
        if (out !== this.last || i === 3) { this.last = out; return out; }
      }
    }
    react(raw) {
      const w = raw.trim(), c = clean(w), words = c.split(/\s+/), joined = c.replace(/\s+/g, "");
      if (/^\d+$/.test(joined)) return this.t("number", w);
      for (const th of THEMES) if (th.w.some((x) => (x.includes(" ") ? c.includes(x) : words.includes(x)) || joined === x.replace(/\s+/g, ""))) return this.t(th.k, w);
      return this.t("unknown", w);
    }
    say(text, hold = 3.2) {
      const el = this.el;
      if (this.tw) this.tw.kill();
      el.classList.add("is-on");
      const o = { n: 0 };
      this.tw = gsap.timeline()
        .to(o, { n: text.length, duration: Math.min(1.4, 0.022 * text.length + 0.2), ease: "none", onUpdate: () => { el.textContent = text.slice(0, Math.round(o.n)); } })
        .call(() => el.classList.remove("is-on"), null, `+=${hold}`);
      return this.tw;
    }
    hush() { if (this.tw) this.tw.kill(); this.el.classList.remove("is-on"); }
    async prepare() {
      try {
        const LM = window.LanguageModel;
        if (!LM || !LM.availability) return;
        if ((await LM.availability()) === "available") this.ai = await LM.create({ initialPrompts: [{ role: "system", content: BRIEF(this.lang, this.locked) }], temperature: 0.9, topK: 40 });
      } catch (e) { this.ai = null; }
    }
    // whatever they wrote: the on-device model if there is one, the repertoire otherwise
    async answer(text) {
      // first choice, for everyone: the site's own little server, which asks Gemini
      if (this.endpoint) {
        try {
          const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 7000);
          const r = await fetch(this.endpoint, { method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang: this.lang, locked: this.locked, history: this.history, text }) });
          clearTimeout(timer);
          if (r.ok) {
            const j = await r.json();
            if (j.text) {
              this.history.push({ role: "user", text }, { role: "model", text: j.text });
              this.history = this.history.slice(-8);
              return { text: j.text, go: j.go || null };
            }
          }
        } catch (e) {}
      }
      if (this.ai) {
        try {
          const r = await Promise.race([this.ai.prompt(text), new Promise((_, x) => setTimeout(() => x(new Error("slow")), 6000))]);
          const go = (r.match(/\[go:(work|about|services|contact)\]/) || [])[1] || null;
          const out = r.replace(/\[go:[a-z]+\]/g, "").replace(/^["“]|["”]$/g, "").trim();
          if (out) return { text: out, go };
        } catch (e) {}
      }
      return { text: this.react(text), go: null };
    }
  }
  window.Voice = Voice;
})();
