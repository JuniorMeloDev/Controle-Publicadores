"""Refresh the local street and named landmark geometry used by territory cards."""
import json
from pathlib import Path
import urllib.request
import xml.etree.ElementTree as ET

SOURCE = 'https://api.openstreetmap.org/api/0.6/map?bbox=-34.933,-8.219,-34.917,-8.202'
request = urllib.request.Request(SOURCE, headers={'User-Agent': 'Controle-Publicadores/1.0 (territory cards)'})
with urllib.request.urlopen(request, timeout=45) as response:
    root = ET.fromstring(response.read())
nodes = {node.attrib['id']: [float(node.attrib['lon']), float(node.attrib['lat'])] for node in root.findall('node')}
roads, landmarks = [], []


def landmark(element, position, prefix):
    tags = {tag.attrib['k']: tag.attrib['v'] for tag in element.findall('tag')}
    if not tags.get('name') or not any(key in tags for key in ['amenity', 'shop', 'leisure', 'tourism']):
        return
    kind = 'school' if tags.get('amenity') in ['school', 'kindergarten', 'university'] else (
        'shop' if 'shop' in tags else 'square' if tags.get('leisure') in ['park', 'garden'] else 'reference')
    landmarks.append({'id': prefix + element.attrib['id'], 'name': tags['name'], 'kind': kind, 'position': position})


for node in root.findall('node'):
    landmark(node, nodes[node.attrib['id']], 'node-')
for way in root.findall('way'):
    tags = {tag.attrib['k']: tag.attrib['v'] for tag in way.findall('tag')}
    points = [nodes[node.attrib['ref']] for node in way.findall('nd') if node.attrib['ref'] in nodes]
    if tags.get('name') and tags.get('highway') and len(points) > 1:
        roads.append({'id': way.attrib['id'], 'name': tags['name'], 'points': points})
    if len(points) > 3 and points[0] == points[-1]:
        polygon = points[:-1]
        position = [sum(p[axis] for p in polygon) / len(polygon) for axis in [0, 1]]
        landmark(way, position, 'way-')
payload = {'source': SOURCE, 'license': 'ODbL-1.0', 'attribution': 'OpenStreetMap contributors', 'roads': roads, 'landmarks': landmarks}
target = Path(__file__).resolve().parents[1] / 'app/lib/territory-street-data.json'
target.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'{len(roads)} streets and {len(landmarks)} named landmarks prepared.')
