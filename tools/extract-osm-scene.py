"""Convert an OpenStreetMap XML extract into the compact 3D scene format."""
import argparse
import json
import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("source")
parser.add_argument("output")
parser.add_argument("--features-out")
parser.add_argument("--lng", type=float, required=True)
parser.add_argument("--lat", type=float, required=True)
parser.add_argument("--x-factor", type=float, required=True)
parser.add_argument("--z-factor", type=float, default=11120)
parser.add_argument("--width", type=float, required=True)
parser.add_argument("--depth", type=float, required=True)
parser.add_argument("--building-width", type=float)
parser.add_argument("--building-depth", type=float)
args = parser.parse_args()

root = ET.parse(args.source).getroot()
node_elements = {e.get("id"): e for e in root if e.tag == "node"}
nodes = {node_id: (float(e.get("lon")), float(e.get("lat"))) for node_id, e in node_elements.items()}
ways = {e.get("id"): e for e in root if e.tag == "way"}

def tags(element):
    return {tag.get("k"): tag.get("v") for tag in element.findall("tag")}

def refs(element):
    return [node.get("ref") for node in element.findall("nd")]

def project(coordinate):
    lng, lat = coordinate
    return [(lng - args.lng) * args.x_factor, (args.lat - lat) * args.z_factor]

def rounded(point):
    return [round(point[0], 3), round(point[1], 3)]

def number(value):
    match = re.match(r"^\s*(\d+(?:\.\d+)?)", value or "")
    return float(match.group(1)) if match else None

half_x, half_z = args.width / 2, args.depth / 2
building_half_x = (args.building_width or args.width) / 2
building_half_z = (args.building_depth or args.depth) / 2

def clip_segment(a, b):
    dx, dz = b[0] - a[0], b[1] - a[1]
    low, high = 0.0, 1.0
    for p, q in ((-dx, a[0] + half_x), (dx, half_x - a[0]), (-dz, a[1] + half_z), (dz, half_z - a[1])):
        if abs(p) < 1e-12:
            if q < 0:
                return None
        elif p < 0:
            low = max(low, q / p)
        else:
            high = min(high, q / p)
        if low > high:
            return None
    return ([a[0] + low * dx, a[1] + low * dz], [a[0] + high * dx, a[1] + high * dz])

def clip_path(points):
    result, active = [], []
    for start, end in zip(points, points[1:]):
        segment = clip_segment(start, end)
        if segment is None:
            if len(active) > 1:
                result.append(active)
            active = []
            continue
        first, last = segment
        if active and math.dist(active[-1], first) < 1e-6:
            active.append(last)
        else:
            if len(active) > 1:
                result.append(active)
            active = [first, last]
    if len(active) > 1:
        result.append(active)
    return result

road_types = {"motorway", "trunk", "primary", "secondary", "tertiary", "residential", "pedestrian", "footway", "path", "service", "unclassified", "living_street", "steps", "cycleway"}
roads, buildings, walls, water, named = [], [], [], {"outer": [], "inner": []}, {}

for node_id, (lng, lat) in nodes.items():
    node = node_elements.get(node_id)
    if node is None:
        continue
    data = tags(node)
    if data.get("name"):
        point = project((lng, lat))
        if abs(point[0]) <= half_x and abs(point[1]) <= half_z:
            named[data["name"]] = {"type": "node", "id": node_id, "lng": lng, "lat": lat, "point": rounded(point)}

for way_id, way in ways.items():
    data = tags(way)
    node_ids = refs(way)
    if len(node_ids) < 2 or any(node_id not in nodes for node_id in node_ids):
        continue
    points = [project(nodes[node_id]) for node_id in node_ids]
    if data.get("name"):
        center = [sum(point[0] for point in points) / len(points), sum(point[1] for point in points) / len(points)]
        named[data["name"]] = {"type": "way", "id": way_id, "lng": nodes[node_ids[len(node_ids)//2]][0], "lat": nodes[node_ids[len(node_ids)//2]][1], "point": rounded(center)}
    if data.get("highway") in road_types:
        for part in clip_path(points):
            roads.append({"id": way_id, "p": [rounded(point) for point in part], "type": data["highway"], "name": data.get("name", ""), "bridge": data.get("bridge") in {"yes", "viaduct"}})
    if data.get("barrier") == "city_wall" or data.get("historic") == "citywalls":
        for part in clip_path(points):
            walls.append({"id": way_id, "p": [rounded(point) for point in part], "name": data.get("name", ""), "material": data.get("material", "stone")})
    if data.get("natural") == "water" and node_ids[0] == node_ids[-1]:
        center_x = sum(point[0] for point in points) / len(points)
        center_z = sum(point[1] for point in points) / len(points)
        if abs(center_x) <= half_x and abs(center_z) <= half_z:
            water["outer"].append([rounded(point) for point in points])
    if data.get("building") not in {None, "no"} and len(node_ids) >= 4 and node_ids[0] == node_ids[-1]:
        center_x = sum(point[0] for point in points) / len(points)
        center_z = sum(point[1] for point in points) / len(points)
        if abs(center_x) > building_half_x or abs(center_z) > building_half_z:
            continue
        height = number(data.get("height"))
        levels = number(data.get("building:levels"))
        basis = "osm_height"
        if not height:
            if levels:
                height, basis = levels * 3, "osm_levels_3m"
            else:
                height, basis = 7, "estimated"
        buildings.append({"id": way_id, "p": [rounded(point) for point in points], "h": round(height / 10, 3), "roof": data.get("roof:shape", "flat"), "heightBasis": basis})

scene = {
    "water": water,
    "roads": roads,
    "buildings": buildings,
    "walls": walls,
    "source": "© OpenStreetMap contributors, ODbL 1.0",
    "retrieved": "2026-09-25",
}
Path(args.output).write_text(json.dumps(scene, ensure_ascii=False, separators=(",", ":")))
if args.features_out:
    Path(args.features_out).write_text(json.dumps(named, ensure_ascii=False, indent=2))
print(json.dumps({"water": len(water["outer"]), "roads": len(roads), "buildings": len(buildings), "walls": len(walls), "named": len(named)}, ensure_ascii=False))
