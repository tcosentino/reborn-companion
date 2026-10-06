# Dumps an RPG Maker XP game's maps to JSON for route maps (scripts/apply-routes.ts) and the map finder (scripts/maps.ts).
# Usage: ruby scripts/dump-maps.rb <gameDir> <outDir>
# Writes <outDir>/index.json (map names and parents), tilesets.json and map<id>.json (tiles + events).
require 'json'
require 'fileutils'

Encoding.default_external = Encoding::UTF_8

# Minimal stand-ins for the RGSS classes Marshal needs; only the fields read below matter.
class Table
  attr_reader :xs, :ys, :zs, :data
  def self._load(s)
    _dim, xs, ys, zs, _n = s[0, 20].unpack('l5')
    t = allocate
    t.instance_variable_set(:@xs, xs)
    t.instance_variable_set(:@ys, ys)
    t.instance_variable_set(:@zs, zs)
    t.instance_variable_set(:@data, s[20..].unpack('s*'))
    t
  end
end
class Color; def self._load(_s) = allocate; end
class Tone; def self._load(_s) = allocate; end

module RPG
  class Map; attr_reader :tileset_id, :width, :height, :data, :events; end
  class MapInfo; attr_reader :name, :parent_id, :order; end
  class Event
    attr_reader :id, :name, :x, :y, :pages
    class Page
      attr_reader :graphic, :list, :through, :condition, :trigger
      class Condition
        attr_reader :switch1_valid, :switch2_valid, :variable_valid, :self_switch_valid
        def any? = switch1_valid || switch2_valid || variable_valid || self_switch_valid
      end
      class Graphic; attr_reader :tile_id, :character_name, :direction, :pattern, :opacity, :blend_type; end
    end
  end
  class EventCommand; attr_reader :code, :parameters; end
  class MoveRoute; end
  class MoveCommand; end
  class AudioFile; end
  class Tileset; attr_reader :name, :tileset_name, :autotile_names, :passages, :priorities, :terrain_tags; end
end

game, out = ARGV
abort 'usage: dump-maps.rb <gameDir> <outDir>' unless game && out
FileUtils.mkdir_p(out)
load_data = ->(f) { File.open(File.join(game, 'Data', f), 'rb') { |io| Marshal.load(io) } }
# Strip RMXP message escapes (\PN, \c[2], \n) so text search reads naturally
clean = ->(t) { t.to_s.gsub(/\\PN/i, 'PLAYER').gsub(/\\[a-z]+\[[^\]]*\]/i, '').gsub(/\\[a-z]/i, ' ').squeeze(' ').strip }

infos = load_data.('MapInfos.rxdata')
File.write(File.join(out, 'index.json'), JSON.generate(infos.to_h { |id, i| [id, { name: i.name, parent: i.parent_id }] }))

tilesets = load_data.('Tilesets.rxdata').each_with_index.filter_map do |ts, i|
  next unless ts
  [i, { name: ts.name, tileset: ts.tileset_name, autotiles: ts.autotile_names,
        passages: ts.passages.data, priorities: ts.priorities.data, terrain: ts.terrain_tags.data }]
end.to_h
File.write(File.join(out, 'tilesets.json'), JSON.generate(tilesets))

count = 0
infos.each_key do |id|
  path = File.join(game, 'Data', format('Map%03d.rxdata', id))
  next unless File.exist?(path)
  map = File.open(path, 'rb') { |io| Marshal.load(io) }
  events = map.events.values.sort_by(&:id).map do |ev|
    pages = ev.pages.map do |p|
      g = p.graphic
      cmds = p.list
      warp = cmds.find { |c| c.code == 201 && c.parameters[0] == 0 }&.parameters
      lines = cmds.select { |c| [101, 401].include?(c.code) }.map { |c| clean.(c.parameters[0]) }
      choices = cmds.select { |c| c.code == 102 }.flat_map { |c| c.parameters[0] }
      page = { cond: p.condition.any?, through: p.through, trigger: p.trigger }
      page[:char] = g.character_name unless g.character_name.empty?
      page[:tile] = g.tile_id if g.tile_id.positive?
      page[:dir] = g.direction if page[:char]
      page[:pattern] = g.pattern if page[:char] && g.pattern.positive?
      page[:opacity] = g.opacity if g.opacity != 255
      page[:blend] = g.blend_type if g.blend_type.positive?
      page[:warp] = { map: warp[1], x: warp[2], y: warp[3] } if warp
      page[:text] = lines.join(' ').gsub(/\s+/, ' ')[0, 600] unless lines.empty?
      page[:choices] = choices unless choices.empty?
      page
    end
    { id: ev.id, name: ev.name, x: ev.x, y: ev.y, pages: pages }
  end
  File.write(File.join(out, "map#{id}.json"), JSON.generate({
    id: id, name: infos[id].name, tileset: map.tileset_id, width: map.width, height: map.height,
    layers: map.data.zs, data: map.data.data, events: events
  }))
  count += 1
end
puts "dumped #{count} maps to #{out}"
