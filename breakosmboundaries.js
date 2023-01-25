import fs from 'fs';
import * as topojson from 'topojson-client';

const topo = JSON.parse(fs.readFileSync(process.argv[2]))
const cache = {}

const insertAncest = (topology, a, parents) => {
    const next = parents.pop();
    if (topology.properties.boundary !== "administrative")
        return

    if (! next) {
        a.features.push(topology)
        return
    }

    if (! a.children[next]) {
        a.children[next]= {
            type: 'FeatureCollection',
            features: [],
            children: {},
            properties: next
        }
    }

    if (parents.length) {
        insertAncest(topology, a.children[next], parents)
    } else {
        a.children[next].features.push(topology)
    }
}

const unOSM = fc => {
    const ret = {type: 'FeatureCollection', features: [], children: {}};
    for (let f of fc.features) {
        cache[f.properties.osm_id] = f.properties
        const parents = (f.properties.parents || "").split(',');
        insertAncest(f, ret, parents)
    }
    return ret;
}

const dumpOSM = (fc, dirName) => {
    const keys = Object.keys(fc.children || {})
    const props = (fc.properties || {osm_id: 'root', name: 'root'})
    const newDir = `${dirName}/${props.name.replace(/ /g, '_')}`
    try {
        fs.mkdirSync(newDir)
    } catch(e){}

    // XXX: sometimes we'll get random features in, this is mostly for Argentina shape
    const min = fc.features.reduce((a,c) => Math.min(a, c.properties.admin_level), 100)
    fc.features = fc.features.filter(f => f.properties.admin_level === min)

    for (let k of keys) {
        fc.children[k].properties = cache[fc.children[k].properties]
        dumpOSM(fc.children[k], newDir)
    }
    delete fc.children;

    fs.writeFileSync(`${newDir}/topology.json`, JSON.stringify(fc))
    fs.symlinkSync(`../../${newDir}/topology.json`, `./data/by-id/${props.osm_id}.json`)
}

//delete topo.objects
const features = topojson.feature(topo, topo.objects['-'])
try {fs.mkdirSync('./data/by-id', {recursive: true})}catch(e){}
dumpOSM(unOSM(features), './data')
