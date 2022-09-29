const http = require('http');
const url = require('url');
const querystring = require('querystring');
const { Client } = require('@elastic/elasticsearch');
const fs = require('fs');

const elasticsearchHost = process.env.ES_URL || 'http://localhost:9200/';
const client = new Client({ node: elasticsearchHost })

const port = process.env.PORT || 80;
const server = http.createServer(async function (request, response) {

    // Set CORS headers
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Request-Method', '*');
    response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
    response.setHeader('Access-Control-Allow-Headers', '*');

    if (request.url.startsWith('/tile')) {
        const urlParse = url.parse(request.url);
        const params = querystring.decode(urlParse.query);

        console.log(`Tile request: ${JSON.stringify(params)}`);

        // Precision level for aggregation cells. Accepts 0-8. Larger numbers result in smaller aggregation cells. If 0, results don’t include the aggs layer.
        let gridPrecision = 0;
        let buffer = 5;
        let size = 10000; // default
        let gridType = ["grid", "point", "centroid"];
        let tempGridType = gridType[0];
        if (params.renderMethod === 'grid') {
            gridPrecision = 8;
            buffer = 5;
            size = 0;
            tempGridType = gridType[0];
        } else if (params.renderMethod === 'heat') {
            gridPrecision = 8;
            buffer = 10;
            size = 0;
            tempGridType = gridType[0];
        } else if (params.renderMethod === 'hex') {
            gridPrecision = 5;
            buffer = 5;
            size = 0;
            tempGridType = gridType[0];
        } else if (params.renderMethod === 'cluster') {
            gridPrecision = 1;
            buffer = 0;
            size = 0;
            tempGridType = gridType[2];
        } else if (params.renderMethod === 'hits') {
            gridPrecision = 0;
            buffer = 0;
            size = 10000;
            tempGridType = gridType[0];
        }

        const body = {
            exact_bounds: false,
            extent: 4096,
            buffer: buffer,
            fields: ["name", "fuel"],
            grid_agg: params.renderMethod !== 'hex' ? 'geotile' : 'geohex',
            grid_precision: gridPrecision,
            grid_type: tempGridType,
            size: size,
            track_total_hits: false,
            with_labels: false,
            query: params.searchQuery ? JSON.parse(params.searchQuery) : {
                "match_all": {}
            },
            // aggs: {
            //     "number_average": {
            //         "avg": {
            //             "field": "number"
            //         }
            //     }
            // }
        }

        console.log(body);

        try {
            const tile = await client.searchMvt({
                index: params.index,
                field: params.geometry,
                zoom: parseInt(params.z),
                x: parseInt(params.x),
                y: parseInt(params.y),
                ...body,
            }, { meta: true });
            // set response header
            response.writeHead(tile.statusCode, {
                'content-disposition': 'inline',
                'content-length': 'content-length' in tile.headers ? tile.headers['content-length'] : `0`,
                'Content-Type': 'content-type' in tile.headers ? tile.headers['content-type'] : 'application/x-protobuf',
                'Cache-Control': `public, max-age=0`,
                'Last-Modified': `${new Date().toUTCString()}`,
            });

            // set response content
            response.write(tile.body);
            response.end();
        } catch (e) {
            console.error(e);
            response.writeHead('statusCode' in e ? e.statusCode : 500);
            response.write(e?.meta?.body ? JSON.stringify(e?.meta?.body) : '');
            response.end();
        }
    } else if (request.url === '/') {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.write(fs.readFileSync('./index.html'));
        response.end('');
    } else if (request.url == '/style.css') {
        response.setHeader('Content-type', 'text/css');
        response.write(fs.readFileSync('style.css'));
        response.end()
    }
    else if (request.url == '/script.js') {
        response.setHeader('type', 'text/javascript');
        response.write(fs.readFileSync('script.js'));
        response.end()
    } else {
        response.writeHead(404);
        response.write('Page does not exist')
        response.end();
    }
});

server.listen(port);
console.log(`Tile server running on port ${port}`);
