// Central source for all UI copy, served as a static API, the frontend fetches
// it with useFetch('/api/content'), the same "data comes from a server route"
// pattern the sibling site uses. Keeping every string here (never hard-coded in
// components) is also the natural place to add multilingual variants later.

// A FAQ entry; some answers carry an optional trailing link (e.g. to NASA's API portal).
type FaqItem = { q: string; a: string; link?: { url: string; label: string } }

export default defineEventHandler(() => {
  return {
    siteName: 'APOD Ask',
    // Per-page SEO copy (title + meta description), fed into useSeoMeta on each page
    // so no page hard-codes its own head tags. The i18n home for meta text too.
    seo: {
      // Titles aim for 50 to 60 characters: shorter wastes the SERP line, longer is
      // truncated. The brand stays in front so the four pages read as one site.
      index: {
        title: 'APOD Ask: grounded answers from NASA\'s APOD archive',
        description:
          'Ask an astronomy question and get an answer grounded in real NASA Astronomy Picture of the Day texts, with the sources.'
      },
      howItWorks: {
        title: 'How it works: embed, retrieve, generate | APOD Ask',
        description:
          'How APOD Ask turns a question into a grounded answer: embed, retrieve, rank, generate. Retrieval you can actually see.'
      },
      about: {
        title: 'About: a hands-on RAG learning project | APOD Ask',
        description:
          'A hands-on RAG project over NASA APOD: Gemini embeddings, an Upstash vector store, and answers grounded in real APOD texts.'
      },
      faq: {
        title: 'FAQ: what you can ask and how RAG works | APOD Ask',
        description:
          'What you can ask, what RAG is, why you sometimes only get closest matches, and how Smart search and Star Trek mode work.'
      }
    },
    header: {
      brand: 'APOD Ask',
      github: 'GitHub ↗',
      githubUrl: 'https://github.com/Milenoi/nuxt-nasa-rag'
    },
    nav: [
      { label: 'Ask', link: '/' },
      { label: 'How it works', link: '/how-it-works' },
      { label: 'FAQ', link: '/faq' },
      { label: 'About', link: '/about' }
    ],
    footer: {
      stages: ['Query', 'Retrieve', 'Rank', 'Answer'],
      idleLabel: 'idle',
      meta: 'embeddings · retrieval · NASA APOD',
      // Plain-language status shown on mobile instead of the full pipeline.
      status: {
        idle: 'idle',
        loading: 'Searching…',
        answer: 'Answer ready',
        empty: 'No matches',
        error: 'Signal lost'
      }
    },
    hero: {
      eyebrow: 'Natural-language APOD search.',
      title: 'Ask the Stars',
      subtitle:
        'Ask anything about astronomy. Answers from real NASA APOD texts, with their images and videos.'
    },
    ask: {
      placeholder: 'e.g. How do stars form?',
      inputLabel: 'Your astronomy question',
      submit: 'Ask',
      examplesToggle: 'Need inspiration?',
      emptyHint: 'Come on, space may be empty, but you still have to ask something.',
      examples: [
        'What is a planetary nebula?',
        'A colorful nebula shaped like an animal',
        'How does a supernova happen?'
      ],
      loading: 'Searching the cosmos…',
      personalityLabel: 'Star Trek answer mode',
      personalityLabelShort: 'Star Trek',
      personalityHint: 'On: answers get a playful Star Trek bridge-officer voice. Off: cool and factual, straight from the sources.',
      rewriteLabel: 'Smart search',
      rewriteHint: 'On: suggests cleaned-up versions of your question (typos fixed, wording tightened) to pick from before searching, so a misspelled or vague query still finds matches. Off: your text is searched exactly as typed.'
    },
    answer: {
      heading: 'Answer',
      // Shown above a clicked (non-top) source: its own APOD description, since the
      // grounded answer only covers the question / top match.
      aboutHeading: 'About this picture',
      // Small caption under that description, clarifying it is NASA's own text.
      aboutNote: "NASA's original APOD description for this picture, not the AI answer.",
      // Link under it, back to the question and its answer (the picture hero replaced
      // both, so this is the only way back without starting a new search).
      backToQuestion: 'Back to your question:',
      // Eyebrow above the model's reply when there is no direct answer, the
      // counterpart of "Answer" above a grounded one.
      noMatchHeading: 'No match',
      // Replaces the "Sources" heading when the model had no direct answer. The short
      // form keeps the heading on one line next to the count on narrow screens.
      closestHeading: 'Closest matches',
      closestHeadingShort: 'Closest',
      // Fallback for the model's own reply in that state (empty remark).
      noAnswerNote: 'No direct answer in the APOD texts, but these came closest to what you asked.',
      sourcesHeading: 'Sources',
      newSearch: 'New search',
      // "{n} APOD pictures", the count is prepended in the component.
      sourcesCount: 'APOD pictures',
      topMatch: 'Top match',
      match: 'Match',
      askedLabel: 'You asked',
      sourceLabel: 'Source',
      viewOriginal: 'View original',
      prevSource: 'Previous source',
      nextSource: 'Next source',
      showInHero: 'Show {title} in the hero'
    },
    // The "did you mean?" step shown when Smart search returns cleaned-up
    // alternatives for the user to pick from before the actual search runs.
    suggest: {
      askedLabel: 'You asked',
      heading: 'Did you mean?',
      intro: 'Smart search tidied up your question. Pick a version, or search exactly what you typed.',
      keepOriginal: 'No, search what I typed',
      loading: 'Tidying up your wording…'
    },
    a11y: {
      answerReady: 'Answer ready.',
      noResults: 'No matching results found.',
      requestError: 'The request failed.',
      suggestionsReady: 'Suggestions ready. Pick one, or keep your original.'
    },
    states: {
      emptyHeading: 'Nothing crossed the event horizon.',
      nonsense: "Come on, don't waste Melanie's tokens on that one. Ask me something actually about space.",
      nonsensePlain: 'That does not look like an astronomy question. Try asking about something in the night sky.',
      error: 'Something went wrong reaching the stars. Please try again.',
      errorHeading: 'The signal fell into a black hole.',
      retry: 'Try again',
      retryOther: 'Ask something else'
    },
    howItWorks: {
      tagline: 'How it works',
      heading: 'Retrieval-Augmented Generation, in plain sight',
      lead: 'Every answer is built in four small steps, from your question to a grounded reply. You can follow exactly how retrieval-augmented generation turns a question into an answer drawn only from real NASA texts.',
      steps: [
        {
          role: 'Query',
          color: 'cyan',
          name: 'Embed the question',
          desc: "Your question is turned into a list of 768 numbers (a vector) by Google's multilingual Gemini embedding model. The same model already turned every APOD description into a vector, so a German question can still find an English text. Meaning becomes math the computer can compare. (With Smart search on, you first pick from cleaned-up versions of your question, typos fixed, before this step.)"
        },
        {
          role: 'Retrieve',
          color: 'cyan',
          name: 'Find the closest texts',
          desc: 'That question-vector goes to the Upstash Vector database, which compares it against every stored APOD vector by cosine similarity and hands back the closest ones. The closer two vectors point, the closer their meaning.'
        },
        {
          role: 'Rank',
          color: 'purple',
          name: 'Keep the best matches',
          desc: "Upstash already hands the matches back sorted by similarity, so this step just takes the top five and applies one cheap guard: if even the closest match scores far too low, skip the model and treat that input as invalid. Scores alone can't tell gibberish from a real question (random text often scores high), so the real judgement is the model's, in the next step. How do we know the cutoff and the top-five are any good? An offline eval (`npm run eval`) asks a set of questions whose right answer we already know and grades how often, and how near the top, the right picture is found (the standard search metrics Recall@K and MRR), so those knobs are set from numbers, not guesses."
        },
        {
          role: 'Answer',
          color: 'green',
          name: 'Generate a grounded answer',
          desc: "The question and the top texts go to Google Gemini. It used to answer in free text with NONSENSE / NO_MATCH markers parsed by hand, brittle and unable to prove which pictures were used; now it fills a fixed JSON form, checked by a schema, so the reply can't drift and invented citations are dropped. An optional Star Trek toggle changes only the tone, never the facts."
        }
      ],
      footnote: 'Built with Nuxt 4 and Google Gemini, a sibling to the',
      showCode: 'Show code',
      hideCode: 'Hide code'
    },
    about: {
      tagline: 'A learning project',
      heading: 'Learning RAG by building it by hand',
      lead1: "I'm a frontend developer, curious about how AI actually works under the hood. Instead of reaching for a framework that hides everything, I wanted to build Retrieval-Augmented Generation from the ground up, so I could actually explain what embedding, retrieval and grounded generation each do, in my own words.",
      lead2: 'So every moving part here is deliberately visible: the embedding step calls a hosted model, the similarity search ranks stored vectors by cosine distance (I first wrote this by hand, then moved it to a hosted vector database), and the language model is told to answer only from the retrieved NASA texts. To check the search rather than trust it blindly, I also built a small eval by hand using the standard search metrics (Recall@K and MRR): it asks questions whose right answer I already know and grades how often, and how near the top, the right picture comes back.',
      lead3: 'It was also my chance to practise Clean Architecture in a Nuxt app: the query and ingest flows are both split into a domain, use cases with ports, and infrastructure adapters, so the core logic never depends on Gemini, Upstash or NASA directly. Arguably over-engineered for a demo this size, but that was exactly the point, to learn the pattern by building it by hand.',
      journey: {
        label: 'How it got here',
        steps: [
          {
            dropped: 'Local Transformers.js embeddings (Xenova/paraphrase-multilingual-MiniLM-L12-v2), in the function.',
            reason: "Too heavy for Netlify's 250 MB function limit.",
            now: 'Google Gemini embeddings: hosted, tiny to ship.'
          },
          {
            dropped: 'Hand-written cosine over one plain JSON file.',
            reason: 'Lovely to learn on, but it will not scale.',
            now: 'A hosted vector database (Upstash Vector), live now.'
          },
          {
            dropped: 'A free-text answer with NONSENSE / NO_MATCH markers, parsed by pattern-matching.',
            reason: 'Brittle to read, and it never verified which pictures were actually cited.',
            now: 'A schema-constrained JSON reply, validated with Zod, with its cited sources checked.'
          },
          {
            dropped: 'Guessing the retrieval thresholds (how similar counts, how many to fetch) by eye.',
            reason: 'No way to tell whether a tweak actually helped or hurt.',
            now: 'A small offline eval that grades retrieval (Recall@K + MRR) so the knobs are set from numbers.'
          }
        ]
      },
      techStackLabel: 'Stack',
      techStack: [
        { label: 'Framework', value: 'Nuxt 4 + Vue, Nitro server routes' },
        { label: 'Embeddings', value: 'Google Gemini: gemini-embedding-001 (multilingual, 768-dim)' },
        { label: 'Vector store', value: 'Upstash Vector (was hand-written cosine over JSON first)' },
        { label: 'Language model', value: 'Google Gemini: gemini-flash-latest (free tier), structured JSON output validated with Zod' },
        { label: 'Data', value: 'NASA Astronomy Picture of the Day API' },
        { label: 'Ingest', value: 'Manual backfill script + a daily Netlify function' },
        { label: 'Hosting', value: 'Netlify' }
      ],
      freeTierNote: 'This is deliberately a free-tier demo, so it can hit the daily quota. A hobby project, built to learn and to show, not to run up costs.',
      cta: 'View the source on GitHub ↗',
      creditText: 'A sibling to the',
      builtBy:
        'Built by Melanie Stief, forever half-hoping for a NASA badge, or at least a window seat past the atmosphere. Until the universe sends the invite, building small things about the cosmos will have to do.',
      creditSep: '·',
      viridisUrl: 'https://viridis.de',
      viridisLabel: 'viridis.de'
    },
    faq: {
      tagline: 'Questions & answers',
      heading: 'What this is, and how to use it',
      lead: 'A few things worth knowing before you ask: what the site does, why it sometimes says no, and what the two toggles change.',
      items: [
        {
          q: 'What can I ask here?',
          a: 'Anything about astronomy. The answer is built only from real NASA Astronomy Picture of the Day (APOD) descriptions, and the pictures behind it are always shown as sources. It covers roughly the last three years of APOD entries.'
        },
        {
          q: 'What is RAG (Retrieval-Augmented Generation)?',
          a: 'Instead of letting the language model answer from memory, the site first retrieves the most relevant real APOD texts and then asks the model to answer only from those. The retrieval grounds the generation, so answers stay tied to real sources instead of being made up.'
        },
        {
          q: 'Why does it only use NASA APOD texts?',
          a: 'Grounding every answer in a fixed, trusted set of texts is the whole point of the demo. It keeps answers honest and lets you check each claim against the source picture, rather than trusting a model\'s general knowledge.'
        },
        {
          q: 'Why NASA?',
          a: 'Honestly, because NASA\'s open APIs are a genuine pleasure to work with. You get a free API key in seconds, with no approval process and no credit card, and the Astronomy Picture of the Day feed was a perfect fit for a small demo: real, well-written explanations, each paired with a striking image. Get your own key at',
          link: { url: 'https://api.nasa.gov/', label: 'api.nasa.gov' }
        },
        {
          q: 'Why do I sometimes get no direct answer, just closest matches?',
          a: 'If the APOD archive does not actually cover your question, the site shows the closest pictures instead of inventing an answer. That is deliberate: it would rather admit a gap than guess.'
        },
        {
          q: 'What does Smart search do?',
          a: 'With Smart search on, your question is first cleaned up (typos fixed, vague wording tightened) and you pick from the suggested versions before searching. It helps a misspelled or fuzzy query still find matches. Off, your text is searched exactly as typed.'
        },
        {
          q: 'What is Star Trek answer mode?',
          a: 'A playful toggle that gives the answer a Star Trek bridge-officer voice. It changes only the tone, never the facts or the sources.'
        },
        {
          q: 'Is my question stored?',
          a: 'No. Your question is sent to the server only to create the search embedding and the grounded answer. It is not saved to a database or tied to an account, and there is no login or tracking of what you ask.'
        },
        {
          q: 'Why does it sometimes fail or hit a limit?',
          a: 'It runs on free API tiers on purpose, so it can reach Google Gemini\'s daily quota. When that happens the site says so honestly instead of faking an answer. Try again later, once the quota resets.'
        },
        {
          q: 'What was the motivation behind building something like this?',
          a: 'Nothing ambitious. It is a small project to get a little closer to the big black box that AI and RAG can feel like, no more and no less. I just wanted to understand a bit of what actually happens between a question going in and an answer coming out. And building something like this alongside my day job was simply a lot of fun.'
        }
      ] as FaqItem[]
    },
    sibling: {
      label: 'APOD caching demo',
      url: 'https://nuxt-cache-project.netlify.app/'
    },
    taurus: {
      label: 'Taurus',
      labelMoved: 'Not Taurus anymore',
      egg: "Aldebaran, the eye of Taurus. Melanie's birthday is in April, so she is a Taurus."
    }
  }
})
