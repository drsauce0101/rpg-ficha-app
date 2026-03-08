const fs = require('fs');
const html = fs.readFileSync('s:/Documentos de Org. de Programação/APPs/GiharadFichaAPP/frontend/templates/ficha.html', 'utf8');

const regex = /<script.*?>([\s\S]*?)<\/script>/gi;
let match;
let i = 0;
while ((match = regex.exec(html)) !== null) {
    let scriptContent = match[1];
    let cleanScript = scriptContent
        .replace(/{% if is_owner %} true{% else %} false{% endif %}/g, 'true')
        .replace(/{% if not is_owner %}/g, '')
        .replace(/{% endif %}/g, '')
        .replace(/\{%.*?%\}/g, '')
        .replace(/\{\{.*?\}\}/g, '""');

    try {
        new Function(cleanScript);
        console.log(`Script ${i} OK`);
    } catch (err) {
        console.log(`\nScript ${i} ERROR: ${err.message}`);

        let lines = cleanScript.split('\n');

        // V8 prints position in eval string
        let matchErr = err.stack.match(/<anonymous>:(\d+):/);
        if (matchErr) {
            let lineNum = parseInt(matchErr[1]) - 1; // 0-indexed inline eval? actually new Function lines are 1-indexed. but let's test.
            console.log(`Error near line ${lineNum}:`);
            for (let j = Math.max(0, lineNum - 5); j <= Math.min(lines.length - 1, lineNum + 5); j++) {
                let prefix = j === lineNum || j === (lineNum - 2) ? '>> ' : '   ';
                console.log(`${prefix}${j + 1}: ${lines[j]}`);
            }
        }
    }
    i++;
}
