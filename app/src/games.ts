// Registry of games this app can render, loaded from the per-game manifests in /games/<id>.json
// (the build scripts read the same files). Each game's generator output lives in public/data/<id>/.
export interface GameConfig {
  id: string
  name: string
  tagline: string
  credit: { label: string; url: string }
  // Base URL that `image.src` paths in the guide resolve against
  imageBase: string
}

const manifests = import.meta.glob<GameConfig>('../../games/*.json', { eager: true, import: 'default' })

// Keep only the app-facing fields; `build` is for the scripts
export const toGameConfig = ({ id, name, tagline, credit, imageBase }: GameConfig): GameConfig =>
  ({ id, name, tagline, credit, imageBase })

export const GAMES: GameConfig[] = Object.values(manifests).map(toGameConfig).sort((a, b) => a.name.localeCompare(b.name))

export const gameById = (id: string) => GAMES.find(g => g.id === id)
