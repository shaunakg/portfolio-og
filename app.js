import { readFile } from 'fs/promises'
import express from 'express'
import nodeHtmlToImage from 'node-html-to-image'

const inDocker = process.argv.includes('--docker')

const app = express()

// Encodate b64 dans les devtool : btoa("Je suis un text\nsur deux lignes")

// ?debug pour afficher les couleurs
// ?html pour afficher la version HTML avant conversion
// ? sur text ça permet d'afficher une erreur plus parlante si pas de text

app.get('/img/:text?/:footer?', async function(req, res) {
    const viewDebug = 'debug' in req.query
    const viewHTML = 'html' in req.query
    const template = req.query.tpl || 'default'
    const maxLength = 200

    const raw = await getTemplate(template)

    let params = req.query;
    for (const [key, value] of Object.entries(params)) {
        if (value.length > maxLength) {
            params[key] = value.slice(0, maxLength - 3) + "...";
        }
    }

    const html = compileTemplate(raw, params, {
        debug: viewDebug
    })

    if (viewHTML) return res.send(html)

    const options = {
        html,
        waitUntil: 'domcontentloaded',
    }

    if(inDocker){
        options.puppeteerArgs = {
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    }

    const image = await nodeHtmlToImage(options)

    res.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'max-age=86400, s-maxage=84000, stale-if-error=3600',
        'Cloudflare-CDN-Cache-Control': 'max-age=24400, stale-if-error=3600',
        'CDN-Cache-Control': '18000, stale-if-error=3600'
    })

    res.end(image, 'binary')
})

async function getTemplate(template) {
    let raw
    console.log('template', template)
    try {
        if (template === 'default') {
            raw = await readFile('./template.html', 'utf8')
        } else {
            raw = await readFile('./template-' + template + '.html', 'utf8')
        }
    } catch (err) {
        throw new Error(`Fuck ! template ${template} not found`)
    }
    return raw
}

function compileTemplate(html, vars, options) {
    let res = html

    for (let [k, v] of Object.entries(vars)) {
        res = res.replaceAll(`|${k}|`, v)
    }

    res = res.replaceAll('|body-css|', options.debug ? 'debug' : '')

    return res
}

// not perfect but enough for now
function isBase64(str) {
    try {
        return btoa(atob(str)) === str
    } catch (err) {
        return false
    }
}

const port = process.env.PORT || 3333
app.listen(port, () => {
    console.log(`App is listening on ${port}`)
})
