// Central source for all UI copy, served as a static API, the frontend fetches
// it with useFetch('/api/content'), the same "data comes from a server route"
// pattern the sibling site uses. Keeping every string here (never hard-coded in
// components) is also the natural place to add multilingual variants later.
export default defineEventHandler(() => {
  return {
    siteName: 'APOD Ask',
    header: {
      brand: 'APOD Ask',
      github: 'GitHub ↗',
      githubUrl: 'https://github.com/Milenoi/nuxt-nasa-rag'
    },
    nav: [
      { label: 'Ask', link: '/' },
      { label: 'How it works', link: '/how-it-works' },
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
      // Shown above the sources when the model had no direct answer.
      closestHeading: 'Closest matches',
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
      showInHero: 'Show {title} in the hero',
      tolerance: 'Relevance',
      toleranceHint: 'Dims the weaker sources so the strong ones stand out. Updates live, no re-ask needed.',
      toleranceEmpty: 'You have dimmed every source. Ease the slider back down.'
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
          desc: "Upstash already hands the matches back sorted by similarity, so this step just takes the top five and applies one cheap guard: if even the closest match scores far too low, skip the model and show the nonsense screen. Scores alone can't tell gibberish from a real question (random text often scores high), so the real judgement is the model's, in the next step. The relevance slider on the results page is separate: it only dims weak sources, it decides nothing here."
        },
        {
          role: 'Answer',
          color: 'green',
          name: 'Generate a grounded answer',
          desc: "The question and the top texts go to Google Gemini with clear rules: reply NONSENSE for gibberish, NO_MATCH for a real question the texts don't cover, otherwise answer using only those descriptions and name the picture. That grounding keeps it honest, and an optional Star Trek toggle changes only the tone, never the facts."
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
      lead2: 'So every moving part here is deliberately visible: the embedding step calls a hosted model, the similarity search ranks stored vectors by cosine distance (I first wrote this by hand, then moved it to a hosted vector database), and the language model is told to answer only from the retrieved NASA texts.',
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
          }
        ]
      },
      techStackLabel: 'Stack',
      techStack: [
        { label: 'Framework', value: 'Nuxt 4 + Vue, Nitro server routes' },
        { label: 'Embeddings', value: 'Google Gemini: gemini-embedding-001 (multilingual, 768-dim)' },
        { label: 'Vector store', value: 'Upstash Vector (was hand-written cosine over JSON first)' },
        { label: 'Language model', value: 'Google Gemini: gemini-flash-latest (free tier)' },
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
