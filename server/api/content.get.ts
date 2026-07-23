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
        'Ask anything about astronomy. Answers from real NASA APOD texts, with their images.'
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
      loading: 'Searching the cosmos…'
    },
    answer: {
      heading: 'Answer',
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
      toleranceHint: 'Sources below the line are left out. Ask again to apply.',
      askAgain: 'Ask again at this tolerance',
      toleranceEmpty: 'No source clears this relevance. Ease the slider back down, or ask again.'
    },
    a11y: {
      answerReady: 'Answer ready.',
      noResults: 'No matching results found.',
      requestError: 'The request failed.'
    },
    states: {
      empty: "I couldn't find anything about that in the APOD texts.",
      emptyHeading: 'Nothing crossed the event horizon.',
      emptyHintSuffix: 'Try an astronomy topic: stars, galaxies, nebulae, planets, comets. Or lower the relevance if you set it high.',
      nonsense: "Come on, don't waste Melanie's tokens on questions that have nothing to do with space. (Or, if you set relevance too high, drag it back down.)",
      error: 'Something went wrong reaching the stars. Please try again.',
      errorHeading: 'The signal fell into a black hole.',
      retry: 'Try again',
      retryOther: 'Ask something else'
    },
    howItWorks: {
      tagline: 'Retrieval-Augmented Generation, in plain sight',
      heading: 'How it works',
      lead: 'Every answer is built in four small steps. There is no black-box vector database. The retrieval is hand-written and fully visible, so you can see exactly how a question turns into a grounded answer.',
      steps: [
        {
          role: 'Query',
          color: 'cyan',
          name: 'Embed the question',
          desc: "Your question is turned into a list of 768 numbers (a vector) by Google's multilingual Gemini embedding model. The same model already turned every APOD description into a vector, so a German question can still find an English text. Meaning becomes math the computer can compare."
        },
        {
          role: 'Retrieve',
          color: 'cyan',
          name: 'Find the closest texts',
          desc: 'That question-vector is compared against every stored APOD vector using cosine similarity, roughly twenty lines of hand-written math over a JSON file. The closer two vectors point, the closer their meaning.'
        },
        {
          role: 'Rank',
          color: 'purple',
          name: 'Keep the best matches',
          desc: 'The results are sorted by similarity and the top five are kept as sources. If even the best match is too weak (below a relevance threshold), the app says it found nothing instead of inventing an answer.'
        },
        {
          role: 'Answer',
          color: 'green',
          name: 'Generate a grounded answer',
          desc: 'The question and the retrieved texts go to Google Gemini with a single rule: answer only from these descriptions. That grounding is what keeps the answer honest, and it is why we can show the exact NASA pictures it drew from.'
        }
      ],
      footnote: 'Built with Nuxt 4 and Google Gemini, a sibling to the',
      showCode: 'Show code',
      hideCode: 'Hide code'
    },
    about: {
      tagline: 'A learning project',
      heading: 'Understanding RAG by building it by hand',
      lead1: "I'm a frontend developer, curious about how AI actually works under the hood. Instead of reaching for a framework that hides everything, I wanted to build Retrieval-Augmented Generation from the ground up, so I could actually explain what embedding, retrieval and grounded generation each do, in my own words.",
      lead2: 'So every moving part here is deliberately visible: the embedding step calls a hosted model, the similarity search is a few lines of hand-written math over a JSON file (no black-box vector database), and the language model is told to answer only from the retrieved NASA texts.',
      techStackLabel: 'Stack',
      techStack: [
        { label: 'Framework', value: 'Nuxt 4 + Vue, Nitro server routes' },
        { label: 'Embeddings', value: 'Google Gemini: gemini-embedding-001 (multilingual, 768-dim)' },
        { label: 'Vector store', value: 'Plain JSON file + hand-written cosine similarity' },
        { label: 'Language model', value: 'Google Gemini: gemini-flash-latest (free tier)' },
        { label: 'Data', value: 'NASA Astronomy Picture of the Day API' },
        { label: 'Hosting', value: 'Netlify' }
      ],
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
      labelMoved: 'Not Taurus anymore'
    }
  }
})
