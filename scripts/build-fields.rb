# Builds out/json/<game>/fields.json from a game's fieldtext.rb (build.fieldsScript in games/<game>.json).
# Usage: /opt/homebrew/opt/ruby/bin/ruby scripts/build-fields.rb <fieldtext.rb> <json-out-dir>
require 'json'

Encoding.default_external = Encoding::UTF_8
Encoding.default_internal = Encoding::UTF_8

ROOT = File.expand_path('..', __dir__)
# Inside a git worktree the gitignored game-scripts/ and out/ live in the main checkout.
MAIN = ENV['POKEMON_REBOR_ROOT'] || File.expand_path('../../..', ROOT)
find = ->(rel) { [ROOT, MAIN].map { |r| File.join(r, rel) }.find { |p| File.exist?(p) } }
abort 'usage: build-fields.rb <fieldtext.rb> <json-out-dir>' unless ARGV.length == 2
# fieldtext.rb is relative to the repo root (or absolute); dex.json in the output dir supplies move/type names.
SRC = (File.absolute_path?(ARGV[0]) ? ARGV[0] : find.call(ARGV[0])) or abort "#{ARGV[0]} not found"
OUT_DIR = ARGV[1]
DEX_PATH = File.join(OUT_DIR, 'dex.json')
OUT = File.join(OUT_DIR, 'fields.json')
DEX = JSON.parse(File.read(DEX_PATH))

module PBStats
  ATTACK = 'Atk'; DEFENSE = 'Def'; SPEED = 'Spe'; SPATK = 'SpA'; SPDEF = 'SpD'; ACCURACY = 'Acc'; EVASION = 'Eva'
end
# fieldtext.rb is a plain Ruby hash literal from the local, trusted game-scripts checkout, so eval is intentional.
eval(File.read(SRC, encoding: 'UTF-8'), TOPLEVEL_BINDING, SRC)

CONDITIONS = {
  '!attacker.isAirborne?' => 'user must be grounded',
  '!opponent.isAirborne?' => 'target must be grounded',
  'self.pbIsSpecial?(type)' => 'special moves only'
}

def title(sym) = sym.to_s.split('_').map(&:capitalize).join(' ')
def move_name(sym) = DEX['moves'].dig(sym.to_s, 'name') || title(sym)
def type_name(sym) = DEX['types'].dig(sym.to_s, 'name') || title(sym)
def clean(msg) = msg.sub(/\A\{1\}/, 'The target').gsub('{1}', 'the target')
def list(syms, &f) = syms.map(&f).join(', ')

def build(f)
  messages = f[:moveMessages].flat_map { |msg, moves| moves.map { |m| [m, clean(msg)] } }.to_h
  types = f[:typeBoosts].flat_map { |m, ts| ts.map { |t| [t, m, f[:typeCondition][t]] } }
  moves = f[:damageMods].flat_map { |m, ms| ms.map { |mv| [mv, m] } }
  type_entry = ->((t, m, c)) { { type: t.to_s, multiplier: m, condition: CONDITIONS[c] }.compact }
  move_entry = ->((mv, m)) { { move: mv.to_s, multiplier: m, note: messages[mv] }.compact }

  changes = []
  changes << "Nature Power becomes #{move_name(f[:naturePower])}" if f[:naturePower] && f[:naturePower] != :TRIATTACK
  changes << "Secret Power becomes #{move_name(f[:secretPower])}" if f[:secretPower] && f[:secretPower] != :TRIATTACK
  changes << "Mimicry and Camouflage become #{type_name(f[:mimicry])}" if f[:mimicry] && f[:mimicry] != :NORMAL
  f[:typeAddOns].each { |add, ts| changes << "#{list(ts) { |t| type_name(t) }} moves also count as #{type_name(add)}" }
  f[:typeMods].each { |t, ms| changes << "#{list(ms) { |m| move_name(m) }} become #{type_name(t)}-type" }
  f[:accuracyMods].each do |acc, ms|
    changes << (acc.zero? ? "#{list(ms) { |m| move_name(m) }} always hit" : "#{list(ms) { |m| move_name(m) }} have #{acc}% accuracy")
  end
  seed = f[:seed]
  if seed[:seedtype]
    parts = seed[:stats].map { |s, n| "#{n > 0 ? '+' : ''}#{n} #{s}" }
    parts << seed[:message].gsub('{1}', 'the user').sub(/[.!]\z/, '') if seed[:message]
    changes << "Seed (#{title(seed[:seedtype]).sub(/seed\z/i, ' Seed')}): #{parts.join(', ')}"
  end
  f[:fieldChange].each do |to, ms|
    name = FIELDEFFECTS.dig(to, :name)
    changes << "#{name.to_s.empty? ? 'Reverts to no field' : "Becomes #{name}"} after #{list(ms.first(5)) { |m| move_name(m) }}#{ms.size > 5 ? ', ...' : ''}"
  end

  boosted_types = types.select { |_, m, _| m > 1 }.map(&:first)
  boosted_move_types = moves.select { |_, m| m > 1 }.map { |mv, _| DEX['moves'].dig(mv.to_s, 'type')&.to_sym }.compact
  # The mimicry type is the field's visual identity; fall back to the most-boosted type.
  dominant = f[:mimicry] != :NORMAL ? f[:mimicry] : (boosted_types + boosted_move_types).reject { |t| t == :NORMAL }.tally.max_by { |_, n| n }&.first
  {
    name: f[:name],
    summary: f[:fieldMessage].reject(&:empty?).join(' '),
    boosts: {
      types: types.select { |_, m, _| m > 1 }.map(&type_entry),
      moves: moves.select { |_, m| m > 1 }.map(&move_entry)
    },
    weakened: {
      types: types.select { |_, m, _| m < 1 }.map(&type_entry),
      moves: moves.select { |_, m| m < 1 }.map(&move_entry)
    },
    changes: changes,
    color: dominant.to_s
  }
end

fields = FIELDEFFECTS.reject { |sym, _| sym == :INDOOR }.map { |sym, f| [sym.to_s, build(f)] }.to_h
File.write(OUT, JSON.pretty_generate(fields) + "\n")
puts "wrote #{fields.size} fields -> #{OUT}"
