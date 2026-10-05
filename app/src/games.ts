// Registry of games this app can render. Each game's generator output lives in public/data/<id>/.
export interface GameConfig {
  id: string
  name: string
  tagline: string
  credit: { label: string; url: string }
  // Base URL that `image.src` paths in the guide resolve against
  imageBase: string
}

export const GAMES: GameConfig[] = [
  {
    id: 'reborn',
    name: 'Pokemon Reborn',
    tagline: 'Complete walkthrough, episodes 1-19 and postgame',
    credit: { label: "BIGJRA's Walkthroughs (MIT)", url: 'https://bigjra.github.io/reborn/' },
    imageBase: 'https://bigjra.github.io'
  }
]

export const gameById = (id: string) => GAMES.find(g => g.id === id)
