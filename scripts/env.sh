# Shared Ruby environment for the generator scripts. Source it after setting ROOT.
export PATH=/opt/homebrew/opt/ruby/bin:$PATH
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 RUBYOPT="-Eutf-8:utf-8"
export GEM_HOME="$ROOT/.gems"
export GEM_PATH="$ROOT/.gems:$(ruby -e 'print Gem.default_dir')"

# Reads a key from games/<id>.json, e.g. `game_value reborn build.generator`
game_value() { node --no-warnings "$ROOT/scripts/game.ts" "$1" "$2"; }

# Exits with usage unless a game id was given and games/<id>.json exists
require_game() {
  if [ -z "${1:-}" ]; then
    echo "usage: $(basename "$0") <game> (one of: $(ls "$ROOT/games" | sed 's/\.json$//' | tr '\n' ' '))" >&2
    exit 1
  fi
  node --no-warnings "$ROOT/scripts/game.ts" "$1" >/dev/null
}
