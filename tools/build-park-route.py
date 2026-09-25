#!/usr/bin/env python3
"""Build a lightweight walking route from mapped park paths.

The output is display guidance for the 3D prototype, not turn-by-turn navigation.
"""

from __future__ import annotations

import heapq
import argparse
import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_STOPS = "flower-valley,double-bridge,wanquan,danleng,immortal-dew,taoyuan,royal-rice,farming-pavilion"
WALKABLE = {
    "footway",
    "path",
    "pedestrian",
    "steps",
    "cycleway",
    "service",
    "living_street",
    "unclassified",
    "residential",
}


def key(point: list[float]) -> tuple[float, float]:
    return round(point[0], 5), round(point[1], 5)


def distance(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def shortest_path(graph, start, end):
    queue = [(0.0, start)]
    best = {start: 0.0}
    previous = {}
    while queue:
        cost, node = heapq.heappop(queue)
        if node == end:
            break
        if cost != best[node]:
            continue
        for neighbour, edge_cost in graph[node]:
            candidate = cost + edge_cost
            if candidate < best.get(neighbour, float("inf")):
                best[neighbour] = candidate
                previous[neighbour] = node
                heapq.heappush(queue, (candidate, neighbour))
    if end not in best:
        raise RuntimeError(f"No mapped walking connection between {start} and {end}")
    result = [end]
    while result[-1] != start:
        result.append(previous[result[-1]])
    result.reverse()
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--destination", default="haidian-park")
    parser.add_argument("--stops", default=DEFAULT_STOPS)
    parser.add_argument("--id", default="autumn-60")
    parser.add_argument("--name", default="60 分钟秋游路线")
    parser.add_argument("--duration", type=int, default=60)
    parser.add_argument("--gap", type=float, default=0.85)
    args = parser.parse_args()

    destination = ROOT / "destinations" / args.destination
    route_order = [item.strip() for item in args.stops.split(",") if item.strip()]
    config = json.loads((destination / "config.json").read_text())
    map_data = json.loads((destination / "map.json").read_text())
    places = {place["id"]: place for place in json.loads((destination / "places.json").read_text())}
    unknown = [place_id for place_id in route_order if place_id not in places]
    if unknown:
        raise SystemExit(f"Unknown route stops: {', '.join(unknown)}")

    graph = {}
    for road in map_data["roads"]:
        if road.get("type") not in WALKABLE:
            continue
        points = [key(point) for point in road["p"]]
        for a, b in zip(points, points[1:]):
            cost = distance(a, b)
            if cost <= 0:
                continue
            graph.setdefault(a, []).append((b, cost))
            graph.setdefault(b, []).append((a, cost))

    # OSM park paths can stop just short of one another at plazas or bridges.
    # Join only sub-9-metre gaps so the route graph matches the visible walkway.
    nodes = list(graph)
    for index, a in enumerate(nodes):
        for b in nodes[index + 1 :]:
            gap = distance(a, b)
            if gap <= args.gap:
                graph[a].append((b, gap))
                graph[b].append((a, gap))

    projection = config["projection"]

    def projected(place_id):
        place = places[place_id]
        return (
            (place["lng"] - projection["lng"]) * projection["xFactor"],
            (projection["lat"] - place["lat"]) * projection["zFactor"],
        )

    snapped = {
        place_id: min(nodes, key=lambda node: distance(node, projected(place_id)))
        for place_id in route_order
    }

    route = []
    for start_id, end_id in zip(route_order, route_order[1:]):
        leg = shortest_path(graph, snapped[start_id], snapped[end_id])
        if route and leg[0] == route[-1]:
            leg = leg[1:]
        route.extend(leg)

    route_length_units = sum(distance(a, b) for a, b in zip(route, route[1:]))
    output = {
        "id": args.id,
        "name": args.name,
        "durationMinutes": args.duration,
        "distanceMeters": round(route_length_units * 10 / 10) * 10,
        "stops": route_order,
        "points": [[round(x, 4), round(z, 4)] for x, z in route],
        "note": "沿 OpenStreetMap 公园步道生成；时长包含沿途观景停留，仅作游览示意。",
        "retrieved": "2026-09-25",
    }
    (destination / "route.json").write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n"
    )
    print(
        f"Wrote {len(route)} route points, about {output['distanceMeters']} m, "
        f"with {len(route_order)} stops."
    )


if __name__ == "__main__":
    main()
