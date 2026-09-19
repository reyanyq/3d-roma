#!/usr/bin/env python3
"""Build compact road-label and metro-station data from a destination map."""

import argparse
import json
import math
import re
from pathlib import Path


def slugify(value):
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "road"


def path_length(points):
    return sum(math.dist(a, b) for a, b in zip(points, points[1:]))


def road_anchor(points):
    if len(points) < 2:
        return None
    lengths = [math.dist(a, b) for a, b in zip(points, points[1:])]
    total = sum(lengths)
    target = total / 2
    travelled = 0
    for index, length in enumerate(lengths):
        if travelled + length >= target:
            ratio = 0 if length == 0 else (target - travelled) / length
            start, end = points[index], points[index + 1]
            point = [round(start[0] + (end[0] - start[0]) * ratio, 3), round(start[1] + (end[1] - start[1]) * ratio, 3)]
            return {"point": point, "from": start, "to": end}
        travelled += length
    return {"point": points[-1], "from": points[-2], "to": points[-1]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("map_json", type=Path)
    parser.add_argument("stations_json", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--road", action="append", default=[])
    args = parser.parse_args()

    map_data = json.loads(args.map_json.read_text())
    roads = []
    used_ids = set()
    for index, name in enumerate(args.road, 1):
        matches = [road for road in map_data["roads"] if road.get("name") == name]
        matches.sort(key=lambda road: path_length(road["p"]), reverse=True)
        if not matches:
            print(f"warning: road not found: {name}")
            continue
        road_id = slugify(name)
        if road_id in used_ids:
            road_id = f"road-{index}"
        used_ids.add(road_id)
        paths = [road["p"] for road in matches]
        anchors = [anchor for anchor in (road_anchor(path) for path in paths[:3]) if anchor]
        roads.append({
            "id": road_id,
            "name": name,
            "paths": paths,
            "anchors": anchors,
            "sourceWayIds": [road["id"] for road in matches],
        })

    stations = json.loads(args.stations_json.read_text())
    args.output.write_text(json.dumps({"roads": roads, "stations": stations}, ensure_ascii=False, separators=(",", ":")))
    print(f"wrote {len(roads)} roads and {len(stations)} stations to {args.output}")


if __name__ == "__main__":
    main()
