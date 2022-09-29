
let loaded = false;

const map = new maplibregl.Map({
    container: 'map',
    center: [106.085, 16.417],
    style: 'https://api.maptiler.com/maps/streets/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL',
    zoom: 5
});

// disable map rotation using right click + drag
map.dragRotate.disable();

map.on('load', function () {
    loaded = true;
});

function showLayer() {
    if (!loaded) {
        return;
    }

    // Get value from DOM
    const indexName = document.getElementById('index').value;
    const geometryFieldName = document.getElementById('geometry_field').value;
    const renderMethod = document.querySelector('input[name="renderMethod"]:checked').value;
    const searchQuery = document.getElementById('search').value;

    // Validate data
    if (!indexName) {
        alert('Cannot show layer. Please set "Elasticsearch index name"');
        return;
    }
    if (!indexName || !geometryFieldName) {
        alert('Cannot show layer. Please set "Field name of geometry"');
        return;
    }

    // Arbitrary value, you can use any string you like
    const sourceName = 'es_mvt';
    const fillStyle = 'layer_fill';
    const outlineStyle = 'layer_line';
    const circleStyle = 'layer_point';
    const heatStyle = 'layer_heat';
    const clusterStyle = 'layer_cluster';
    const clusterCountStyle = 'cluster-count';
    const unclusteredStyle = 'unclustered-point';

    // Elasticsearch vector tile API returns tiles with 3 layers
    // "hits": Contains a feature for each document (hit) matching search criteria.
    // "aggs": Contains a feature for each bucket returned from geotile_grid or geohex_grid aggregation.
    // "meta": Contains a single feature with meta data about the feature properties.
    //         These are useful for calculating dynamic style ranges but not used in this example.

    // 'vector' layer specification requires "source-layer" property. This property identifies the layer to display from the tile.
    const sourceLayer = renderMethod === "hits" ? "hits" : "aggs"; // not arbitrary value - must be layer name provided from tile

    if (map.getSource(sourceName)) {
        map.removeLayer(outlineStyle);
        map.removeLayer(fillStyle);
        map.removeLayer(circleStyle);
        map.removeLayer(heatStyle);
        map.removeLayer(clusterStyle);
        map.removeLayer(clusterCountStyle);
        map.removeLayer(unclusteredStyle);
        map.removeSource(sourceName);
    }

    map.addSource(sourceName, {
        'type': 'vector',
        'tiles': [
            `http://localhost/tile?index=${indexName}&geometry=${geometryFieldName}&renderMethod=${renderMethod}&x={x}&y={y}&z={z}&searchQuery=${searchQuery}`
        ],
        'minzoom': 0,
        'maxzoom': 29,
    });

    const fillColor = 'rgb(255,0,0)';
    const fillOpacity = 0.5;
    const strokeColor = 'rgb(255,0,0)';
    const strokeOpacity = 1;
    const strokeWidth = 1;

    if (renderMethod == 'grid') {
        map.addLayer(
            {
                'id': outlineStyle,
                'type': 'line',
                'source': sourceName,
                'source-layer': sourceLayer,
                'paint': {
                    'line-opacity': strokeOpacity,
                    'line-color': strokeColor,
                    'line-width': 1,
                }
            }
        );
        map.setFilter(outlineStyle, [
            'any',
            ['==', ['geometry-type'], 'Polygon'],
            ['==', ['geometry-type'], 'MultiPolygon'],
            ['==', ['geometry-type'], 'LineString'],
            ['==', ['geometry-type'], 'MultiLineString'],
        ]);
    }

    if (renderMethod == 'hex') {
        map.addLayer(
            {
                'id': fillStyle,
                'type': 'fill',
                'source': sourceName,
                'source-layer': sourceLayer,
                'paint': {
                    'fill-opacity': fillOpacity,
                    'fill-color': fillColor,
                }
            }
        );
        map.setFilter(fillStyle, [
            'any',
            ['==', ['geometry-type'], 'Polygon'],
            ['==', ['geometry-type'], 'MultiPolygon'],
        ]);
    }

    if (renderMethod == 'hits') {
        map.addLayer(
            {
                'id': circleStyle,
                'type': 'circle',
                'source': sourceName,
                'source-layer': sourceLayer,
                'paint': {
                    'circle-radius': 4,
                    'circle-color': fillColor,
                    'circle-opacity': fillOpacity,
                    'circle-stroke-color': strokeColor,
                    'circle-stroke-opacity': strokeOpacity,
                    'circle-stroke-width': strokeWidth,
                }
            }
        );
        map.setFilter(circleStyle, [
            'any',
            ['==', ['geometry-type'], 'Point'],
            ['==', ['geometry-type'], 'MultiPoint'],
        ]);
    }

    if (renderMethod == 'heat') {
        map.addLayer(
            {
                'id': heatStyle,
                'type': 'heatmap',
                'source': sourceName,
                'source-layer': sourceLayer,
                'maxzoom': 21,
                'paint': {
                    // Increase the heatmap weight based on frequency and property magnitude
                    'heatmap-weight': [
                        'interpolate',
                        ['linear'],
                        ['get', '_count'],
                        10,
                        0.05,
                        100,
                        0.1,
                        500,
                        0.2,
                        1000,
                        0.3,
                        2500,
                        0.5,
                        4000,
                        0.8,
                        5000,
                        1
                    ],
                    // Change weight point base on zoom level
                    'heatmap-intensity': [
                        'interpolate',
                        ['linear'],
                        ['zoom'], // return level zoom
                        0, // level zoom
                        0, // level weight
                        10,
                        1.5,
                        20,
                        3,
                        30,
                        4.5
                    ],
                    'heatmap-color': [
                        'interpolate',
                        ['linear'],
                        ['heatmap-density'],
                        0,
                        'rgba(0, 0, 255, 0)',
                        0.1,
                        'rgb(65, 105, 225)',
                        0.28,
                        'rgb(0, 256, 256)',
                        0.45999999999999996,
                        'rgb(0, 256, 0)',
                        0.64,
                        'rgb(256, 256, 0)',
                        0.82,
                        'rgb(256, 0, 0)',
                    ],
                    'heatmap-radius': 8, // Kibana adjust: 0, 8, 32, 64, 128
                    'heatmap-opacity': 0.75
                }
            }
        );
    }

    if (renderMethod == 'cluster') {
        map.addLayer({
            'id': clusterStyle,
            'type': 'circle',
            'source': sourceName,
            'source-layer': sourceLayer,
            'filter': ['has', '_count'],
            'paint': {
                'circle-color': [
                    'step',
                    ['get', '_count'],
                    '#99ffcc',
                    500,
                    '#00ffff',
                    1000,
                    '#cc99ff',
                    2000,
                    '#ffcc66',
                    5000,
                    '#FF99CC'
                ],
                'circle-radius': [
                    'step',
                    ['get', '_count'],
                    0,
                    1,
                    15,
                    100,
                    20,
                    500,
                    25,
                    1000,
                    30,
                    3000,
                    35,
                    5000,
                    40
                ],
                "circle-stroke-width": 0.5,
                "circle-stroke-color": "#ffffff",
                "circle-opacity": 0.75
            }
        });

        map.addLayer({
            id: clusterCountStyle,
            type: 'symbol',
            'source': sourceName,
            'source-layer': sourceLayer,
            'filter': ['has', '_count'],
            layout: {
                'text-field': '{_count}',
                'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                'text-size': 12
            }
        });

        // filter if count == 1
        map.addLayer({
            id: unclusteredStyle,
            type: 'circle',
            'source': sourceName,
            'source-layer': sourceLayer,
            filter: ['!', ['has', '_count']],
            paint: {
                'circle-color': '#11b4da',
                'circle-radius': 4,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff'
            }
        });
    }
}

document.onkeydown = function (evt) {
    var keyCode = evt
        ? evt.which
            ? evt.which
            : evt.keyCode
        : event.keyCode;
    if (keyCode == 13) { showLayer(); }
};